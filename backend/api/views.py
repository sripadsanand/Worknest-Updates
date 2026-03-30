from django.db.models import Q
from rest_framework import viewsets, permissions, status, views, generics
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from .models import User, Task, Announcement, Message
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    TaskSerializer,
    AnnouncementSerializer,
    MessageSerializer,
)
from .services.ai_service import (
    generate_ai_response,
    generate_suggest_replies,
    summarize_conversation,
)


# -----------------------------------------------------------------
# Custom permission helpers
# -----------------------------------------------------------------
class IsAdminOrManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ("Admin", "Manager")


class IsAdminOrManagerOrReadOnly(permissions.BasePermission):
    """Allow Admin/Manager to write; any authenticated user to read."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.role in ("Admin", "Manager")


# -----------------------------------------------------------------
# /api/users/me/
# -----------------------------------------------------------------
class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# -----------------------------------------------------------------
# Users
# -----------------------------------------------------------------
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]


from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied

# -----------------------------------------------------------------
# Tasks — role-filtered queryset, auto-set assigned_by
# -----------------------------------------------------------------
class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        
        # Role-based filtering
        if user.role == "Admin":
            qs = Task.objects.all()
        elif user.role == "Manager":
            qs = Task.objects.filter(
                Q(assigned_by=user) | 
                Q(assigned_to=user) | 
                Q(assigned_to__role="Employee")
            ).distinct()
        else:
            # Employees only see their own tasks
            qs = Task.objects.filter(assigned_to=user)
            
        # Smart Date Filtering
        filter_param = self.request.query_params.get("filter", None)
        if filter_param:
            from django.utils import timezone
            from datetime import timedelta
            
            today = timezone.now().date()
            if filter_param == "today":
                qs = qs.filter(due_date=today)
            elif filter_param == "tomorrow":
                qs = qs.filter(due_date=today + timedelta(days=1))
            elif filter_param == "overdue":
                qs = qs.filter(due_date__lt=today).exclude(status="done")
                
        return qs.order_by("-created_at")

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [IsAdminOrManager()]
        # update/partial_update: Employees can update status. 
        # Restrictions on field edits are handled in perform_update.
        return [IsAuthenticated()]

    def _validate_assignment(self, assigned_to_user):
        """Helper to validate if current user can assign to target user."""
        user = self.request.user
        if user.role == "Employee":
            raise PermissionDenied("Employees cannot assign tasks.")
            
        if not assigned_to_user:
            return  # Assigning to nobody is okay for Admin/Manager
        
        if user.role == "Admin":
            return # Admin can assign to anyone
            
        if user.role == "Manager":
            if assigned_to_user.role != "Employee":
                raise PermissionDenied("Managers can only assign tasks to Employees.")

    def perform_create(self, serializer):
        assigned_to_user = serializer.validated_data.get('assigned_to')
        # Emulate assignment validation (if user tries to assign upon creation)
        if assigned_to_user or self.request.data.get('assigned_to_id'):
            self._validate_assignment(assigned_to_user)
        serializer.save(assigned_by=self.request.user)

    def perform_update(self, serializer):
        # Prevent Employee from updating fields other than status
        user = self.request.user
        if user.role == "Employee":
            allowed_fields = {'status'}
            set_fields = set(serializer.validated_data.keys())
            if not set_fields.issubset(allowed_fields):
                raise PermissionDenied("Employees can only update task status.")
                
        # Validate assignment logic if trying to re-assign task
        if 'assigned_to' in serializer.validated_data:
            assigned_to_user = serializer.validated_data.get('assigned_to')
            self._validate_assignment(assigned_to_user)

        serializer.save()

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        task = self.get_object()
        user_id = request.data.get('assigned_to_id')
        
        # If explicitly sending null/blank string for unassignment
        if user_id is None or user_id == "":
            self._validate_assignment(None)
            task.assigned_to = None
            task.save()
            return Response(TaskSerializer(task).data)

        try:
            target_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_400_BAD_REQUEST)
            
        self._validate_assignment(target_user)
        task.assigned_to = target_user
        task.save()
        
        return Response(TaskSerializer(task).data)


# -----------------------------------------------------------------
# Announcements — admin/manager write, anyone read
# -----------------------------------------------------------------
class AnnouncementViewSet(viewsets.ModelViewSet):
    queryset = Announcement.objects.all().order_by("-created_at")
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrManagerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# -----------------------------------------------------------------
# Messages — 1-to-1 history via REST (WebSocket handles real-time)
# -----------------------------------------------------------------
class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        other_id = request.query_params.get("with_user")
        if not other_id:
            return Response({"error": "with_user query param required."}, status=400)
        try:
            other_user = User.objects.get(pk=other_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)

        messages = Message.objects.filter(
            Q(sender=request.user, receiver=other_user) |
            Q(sender=other_user, receiver=request.user)
        ).order_by("timestamp")

        # Mark as read
        messages.filter(receiver=request.user, is_read=False).update(is_read=True)

        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]
    queryset = Message.objects.all()

    def get_queryset(self):
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(receiver=user)
        ).order_by("timestamp")

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)


# -----------------------------------------------------------------
# AI Copilot — shared rate limiter
# -----------------------------------------------------------------
from django.core.cache import cache

def _check_rate_limit(user, endpoint: str, limit: int = 20, window: int = 60) -> bool:
    """
    Simple in-memory rate limiter using Django cache.
    Returns True if the request is allowed, False if rate limited.
    """
    key = f"ai_rl:{endpoint}:{user.id}"
    count = cache.get(key, 0)
    if count >= limit:
        return False
    cache.set(key, count + 1, timeout=window)
    return True


class AIAssistantView(APIView):
    """POST /api/ai/chat/ — Main copilot endpoint."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _check_rate_limit(request.user, "chat", limit=20, window=60):
            return Response(
                {"error": "Rate limit exceeded. Please wait a moment before sending another message."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user_message = str(request.data.get("message", "")).strip()
        chat_history = request.data.get("history", [])

        if not user_message:
            return Response({"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(user_message) > 2000:
            return Response({"error": "Message is too long (max 2000 characters)."}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(chat_history, list):
            chat_history = []

        response_text = generate_ai_response(request.user, user_message, chat_history)
        return Response({"response": response_text}, status=status.HTTP_200_OK)


class AISuggestReplyView(APIView):
    """POST /api/ai/suggest-reply/ — Returns 3 smart reply suggestions for a chat thread."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _check_rate_limit(request.user, "suggest", limit=10, window=60):
            return Response(
                {"error": "Rate limit exceeded."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        messages_raw = request.data.get("messages", [])
        if not isinstance(messages_raw, list) or len(messages_raw) == 0:
            return Response({"error": "messages array is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Sanitize — only accept strings
        conversation_snippet = [str(m)[:300] for m in messages_raw if isinstance(m, str)][:10]

        suggestions = generate_suggest_replies(request.user, conversation_snippet)
        return Response({"suggestions": suggestions}, status=status.HTTP_200_OK)


class AISummarizeView(APIView):
    """POST /api/ai/summarize/ — Summarizes a chat conversation."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _check_rate_limit(request.user, "summarize", limit=5, window=60):
            return Response(
                {"error": "Rate limit exceeded."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        messages_raw = request.data.get("messages", [])
        if not isinstance(messages_raw, list) or len(messages_raw) == 0:
            return Response({"error": "messages array is required."}, status=status.HTTP_400_BAD_REQUEST)

        conversation_snippet = [str(m)[:300] for m in messages_raw if isinstance(m, str)][:20]

        summary = summarize_conversation(request.user, conversation_snippet)
        return Response({"summary": summary}, status=status.HTTP_200_OK)