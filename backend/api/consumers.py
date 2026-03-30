"""
DirectMessageConsumer: 1-to-1 real-time chat over WebSockets.

URL: ws/chat/<receiver_id>/?token=<access_jwt>

The room name is derived from the sorted pair of user IDs so both
participants join the same channel group regardless of who initiates.

Protocol (JSON):
  → client sends: {"action": "send", "content": "Hello"}
  ← server sends: {"action": "message", "id": 1, "sender_id": 2,
                   "sender_name": "alice", "content": "Hello",
                   "timestamp": "2026-03-25T12:00:00Z"}
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from .models import Message

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@database_sync_to_async
def get_user_from_token(token_str):
    """Authenticate a JWT access token and return the User or None."""
    try:
        token = AccessToken(token_str)
        user_id = token["user_id"]
        return User.objects.get(pk=user_id)
    except (TokenError, InvalidToken, User.DoesNotExist, KeyError):
        return None


@database_sync_to_async
def can_chat(sender, receiver):
    """
    Role-based messaging rules:
      Admin   -> anyone
      Manager -> Admin + any Employee
      Employee-> their Manager (and Admin)
    """
    if sender.role == "Admin":
        return True
    if sender.role == "Manager":
        return receiver.role in ("Admin", "Employee")
    # Employee
    return receiver.role in ("Admin", "Manager")


@database_sync_to_async
def save_message(sender, receiver, content):
    return Message.objects.create(sender=sender, receiver=receiver, content=content)


@database_sync_to_async
def get_receiver(receiver_id):
    try:
        return User.objects.get(pk=receiver_id)
    except User.DoesNotExist:
        return None


# ---------------------------------------------------------------------------
# Consumer
# ---------------------------------------------------------------------------

class DirectMessageConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        # 1. Authenticate via ?token= query string
        query_string = self.scope.get("query_string", b"").decode()
        token_str = None
        for part in query_string.split("&"):
            if part.startswith("token="):
                token_str = part[len("token="):]
                break

        self.user = await get_user_from_token(token_str) if token_str else None
        if not self.user:
            await self.close(code=4001)
            return

        # 2. Resolve receiver
        self.receiver_id = self.scope["url_route"]["kwargs"].get("receiver_id")
        self.receiver = await get_receiver(self.receiver_id)
        if not self.receiver:
            await self.close(code=4004)
            return

        # 3. Role check
        allowed = await can_chat(self.user, self.receiver)
        if not allowed:
            await self.close(code=4003)
            return

        # 4. Join private room group
        ids = sorted([self.user.id, self.receiver.id])
        self.room_name = f"dm_{ids[0]}_{ids[1]}"
        await self.channel_layer.group_add(self.room_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_name"):
            await self.channel_layer.group_discard(self.room_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        action = data.get("action", "send")

        if action == "send":
            content = (data.get("content") or "").strip()
            if not content:
                return

            msg = await save_message(self.user, self.receiver, content)

            await self.channel_layer.group_send(
                self.room_name,
                {
                    "type": "chat_message",
                    "action": "message",
                    "id": msg.id,
                    "sender_id": self.user.id,
                    "sender_name": self.user.username,
                    "receiver_id": self.receiver.id,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))


# ---------------------------------------------------------------------------
# Legacy room consumer kept for backward compat (can be removed later)
# ---------------------------------------------------------------------------
from .models import RoomMessage


class LiveChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_group_name = "live_chat"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get("action")

        if action == "chat_message":
            sender_id = data.get("sender_id")
            content = data.get("content")
            msg = await self.create_room_message(sender_id, content)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "id": msg.id,
                    "sender_id": msg.sender.id,
                    "sender_name": msg.sender.username,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                    "action": "chat_message"
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def create_room_message(self, sender_id, content):
        user = User.objects.get(id=sender_id)
        return RoomMessage.objects.create(sender=user, content=content)
