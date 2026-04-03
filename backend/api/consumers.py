"""
Chat Consumers — WorkNest real-time messaging over WebSockets.

DirectMessageConsumer
  URL: ws/chat/<receiver_id>/?token=<jwt>
  Protocol: {"action": "send", "content": "Hello"}

GroupChatConsumer
  URL: ws/group/<group_id>/?token=<jwt>
  Protocol: {"action": "send", "content": "Hello"}
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken

from .models import Message, ChatGroup

User = get_user_model()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

@database_sync_to_async
def get_user_from_token(token_str):
    try:
        token = AccessToken(token_str)
        return User.objects.get(pk=token["user_id"])
    except (TokenError, InvalidToken, User.DoesNotExist, KeyError):
        return None


@database_sync_to_async
def get_receiver(receiver_id):
    try:
        return User.objects.get(pk=receiver_id)
    except User.DoesNotExist:
        return None


@database_sync_to_async
def can_chat(sender, receiver):
    if sender.role == "Admin":
        return True
    if sender.role == "Manager":
        return receiver.role in ("Admin", "Employee")
    return receiver.role in ("Admin", "Manager")


@database_sync_to_async
def save_dm(sender, receiver, content):
    return Message.objects.create(sender=sender, receiver=receiver, content=content)


@database_sync_to_async
def get_group_if_member(group_id, user):
    """Return the ChatGroup if user is a member, else None."""
    try:
        group = ChatGroup.objects.get(pk=group_id)
        if group.members.filter(id=user.id).exists():
            return group
        return None
    except ChatGroup.DoesNotExist:
        return None


@database_sync_to_async
def save_group_message(sender, group, content):
    return Message.objects.create(sender=sender, group=group, content=content)


# ---------------------------------------------------------------------------
# Direct Message Consumer
# ---------------------------------------------------------------------------

class DirectMessageConsumer(AsyncWebsocketConsumer):

    async def connect(self):
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

        self.receiver_id = self.scope["url_route"]["kwargs"].get("receiver_id")
        self.receiver = await get_receiver(self.receiver_id)
        if not self.receiver:
            await self.close(code=4004)
            return

        allowed = await can_chat(self.user, self.receiver)
        if not allowed:
            await self.close(code=4003)
            return

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

        if data.get("action") == "send":
            content = (data.get("content") or "").strip()
            if not content:
                return
            msg = await save_dm(self.user, self.receiver, content)
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
# Group Chat Consumer
# ---------------------------------------------------------------------------

class GroupChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
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

        group_id = self.scope["url_route"]["kwargs"].get("group_id")
        self.group = await get_group_if_member(group_id, self.user)
        if not self.group:
            await self.close(code=4003)
            return

        self.room_name = f"group_{self.group.id}"
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

        if data.get("action") == "send":
            content = (data.get("content") or "").strip()
            if not content:
                return
            msg = await save_group_message(self.user, self.group, content)
            await self.channel_layer.group_send(
                self.room_name,
                {
                    "type": "chat_message",
                    "action": "message",
                    "id": msg.id,
                    "group_id": self.group.id,
                    "sender_id": self.user.id,
                    "sender_name": self.user.username,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))


# ---------------------------------------------------------------------------
# Legacy room consumer (kept for backward compat)
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
        if data.get("action") == "chat_message":
            msg = await self.create_room_message(data.get("sender_id"), data.get("content"))
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "chat_message",
                    "id": msg.id,
                    "sender_id": msg.sender.id,
                    "sender_name": msg.sender.username,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat(),
                    "action": "chat_message",
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def create_room_message(self, sender_id, content):
        user = User.objects.get(id=sender_id)
        return RoomMessage.objects.create(sender=user, content=content)
