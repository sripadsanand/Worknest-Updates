from datetime import date

from django.db.models import Q
from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied

from .models import User, Task, Announcement, Message, ChatGroup
from .serializers import (
    UserSerializer,
    UserProfileSerializer,
    UserMinimalSerializer,
    TaskSerializer,
    AnnouncementSerializer,
    MessageSerializer,
    ChatGroupSerializer,
    GroupMessageSerializer,
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
# Utility: Dependent Dropdowns
# -----------------------------------------------------------------
class DepartmentSectionsView(APIView):
    """
    Returns roles/sections associated with a specific department.
    Used for dynamic dependent dropdowns in the UI.
    """
    permission_classes = [IsAuthenticated]

    DEPARTMENT_SECTIONS = {
        "IT": ["Developer", "Tester", "Security Engineer", "DevOps Engineer", "System Administrator"],
        "HR": ["HR Executive", "Recruiter", "HR Manager", "Payroll Specialist"],
        "FINANCE": ["Accountant", "Financial Analyst", "Auditor", "Tax Consultant"],
    }

    def get(self, request, department):
        from .models import User
        # Department choices: "HR", "IT", "FINANCE"
        dept_key = str(department).upper()
        sections = self.DEPARTMENT_SECTIONS.get(dept_key, [])
        return Response({"sections": sections})


class DepartmentUsersView(APIView):
    """
    Returns users associated with a specific department natively.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, department):
        from .models import User
        users = User.objects.filter(department__iexact=department)
        serializer = UserMinimalSerializer(users, many=True)
        return Response({"users": serializer.data})


# -----------------------------------------------------------------
# Users
# -----------------------------------------------------------------
class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def _reassign_department(self, department):
        """Re-evaluates and fixes the manager assignments for an entire department."""
        if not department:
            return
            
        manager_sections = {
            "HR": ["HR Manager"],
            "IT": ["Tech Lead", "Tech Lead / Manager"],
            "FINANCE": ["Finance Manager"]
        }
        
        manager = User.objects.filter(
            department=department,
            section__in=manager_sections.get(department, [])
        ).order_by('id').first()

        if not manager:
            manager = User.objects.filter(
                department=department,
                role__in=[User.Roles.MANAGER, User.Roles.ADMIN]
            ).order_by('-seniority', 'id').first()

        users_in_dept = User.objects.filter(department=department)
        for u in users_in_dept:
            is_acting_manager = (u.section in manager_sections.get(department, []))
            assigned_manager_id = None
            if u == manager or u.role in (User.Roles.MANAGER, User.Roles.ADMIN) or is_acting_manager:
                if u.manager is not None:
                    u.manager = None
                    u.save(update_fields=['manager'])
            else:
                if u.manager != manager:
                    u.manager = manager
                    u.save(update_fields=['manager'])
                assigned_manager_id = manager.id if manager else None
                if not manager:
                    print("WARNING: No manager found for this department")

            print({
                "department": u.department,
                "section": u.section,
                "assignedManagerId": assigned_manager_id
            })

    def perform_create(self, serializer):
        user = serializer.save()
        self._reassign_department(user.department)

    def perform_update(self, serializer):
        old_department = serializer.instance.department
        user = serializer.save()
        departments_to_update = {user.department}
        if old_department and old_department != user.department:
            departments_to_update.add(old_department)
        for dept in departments_to_update:
            self._reassign_department(dept)

    def perform_destroy(self, instance):
        dept = instance.department
        super().perform_destroy(instance)
        self._reassign_department(dept)

    @action(detail=True, methods=['get'])
    def team(self, request, pk=None):
        """Retrieve all explicit subordinates under this specific user."""
        user = self.get_object()
        subordinates = user.subordinates.all().order_by('first_name', 'username')
        serializer = UserMinimalSerializer(subordinates, many=True)
        return Response({"team": serializer.data})



# -----------------------------------------------------------------
# Tasks — role-filtered queryset, auto-set assigned_by
# -----------------------------------------------------------------
class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.role == "Admin":
            qs = Task.objects.all()
        elif user.role == "Manager":
            qs = Task.objects.filter(
                Q(assigned_by=user) |
                Q(assigned_to=user) |
                Q(assigned_users=user) |
                Q(assigned_to__role="Employee")
            ).distinct()
        else:
            qs = Task.objects.filter(
                Q(assigned_to=user) |
                Q(assigned_users=user)
            ).distinct()

        filter_param = self.request.query_params.get("filter", None)
        if filter_param:
            from django.utils import timezone
            from datetime import timedelta
            # Use localdate() for timezone-aware comparison (respects IST/server TZ)
            today = timezone.localdate()
            if filter_param == "today":
                qs = qs.filter(due_date=today)
            elif filter_param == "tomorrow":
                qs = qs.filter(due_date=today + timedelta(days=1))
            elif filter_param == "overdue":
                qs = qs.filter(due_date__lt=today, due_date__isnull=False).exclude(status="done")
            elif filter_param == "this_week":
                week_end = today + timedelta(days=6 - today.weekday())  # Sunday
                qs = qs.filter(due_date__gte=today, due_date__lte=week_end)
            elif filter_param == "next_7_days":
                qs = qs.filter(due_date__gte=today, due_date__lte=today + timedelta(days=7))

        return qs.order_by("due_date", "-created_at")

    def get_permissions(self):
        if self.action in ("create", "destroy"):
            return [IsAdminOrManager()]
        return [IsAuthenticated()]

    def _validate_assignment(self, assigned_to_user):
        user = self.request.user
        if user.role == "Employee":
            raise PermissionDenied("Employees cannot assign tasks.")
        if not assigned_to_user:
            return
        if user.role == "Admin":
            return
        if user.role == "Manager" and assigned_to_user.role != "Employee":
            raise PermissionDenied("Managers can only assign tasks to Employees.")

    def perform_create(self, serializer):
        due_date = serializer.validated_data.get("due_date")
        if due_date and due_date < date.today():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"due_date": "Due date cannot be in the past."})
        assigned_to_user = serializer.validated_data.get('assigned_to')
        if assigned_to_user or self.request.data.get('assigned_to_id'):
            self._validate_assignment(assigned_to_user)
        
        dept = serializer.validated_data.get('assigned_to_department')
        task = serializer.save(assigned_by=self.request.user)
        if dept:
            task.assigned_users.set(User.objects.filter(department__iexact=dept))

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == "Employee":
            allowed_fields = {'status'}
            if not set(serializer.validated_data.keys()).issubset(allowed_fields):
                raise PermissionDenied("Employees can only update task status.")
        if 'assigned_to' in serializer.validated_data:
            self._validate_assignment(serializer.validated_data.get('assigned_to'))
        
        dept = serializer.validated_data.get('assigned_to_department')
        task = serializer.save()
        if 'assigned_to_department' in serializer.validated_data:
            if dept:
                task.assigned_users.set(User.objects.filter(department__iexact=dept))
            else:
                task.assigned_users.clear()

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        task = self.get_object()
        user_id = request.data.get('assigned_to_id')
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
# Announcements — smart targeting by seniority + department
# -----------------------------------------------------------------
class AnnouncementViewSet(viewsets.ModelViewSet):
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAdminOrManagerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        if user.role in ("Admin", "Manager"):
            return Announcement.objects.all().order_by("-created_at")
        return Announcement.objects.filter(
            Q(audience_type="All") | Q(audience_type=user.seniority),
            department=user.department,
        ).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# -----------------------------------------------------------------
# Messages — 1-to-1 history via REST
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

        messages.filter(receiver=request.user, is_read=False).update(is_read=True)
        return Response(MessageSerializer(messages, many=True).data)


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
# Group Chat
# -----------------------------------------------------------------
class ChatGroupViewSet(viewsets.ModelViewSet):
    """
    GET  /groups/         → list groups the current user is a member of
    POST /groups/         → create a new group
    GET  /groups/<id>/    → retrieve group details (members only)
    POST /groups/<id>/add_member/    → add a member (creator only)
    POST /groups/<id>/remove_member/ → remove a member (creator only)
    """
    serializer_class = ChatGroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatGroup.objects.filter(members=self.request.user).order_by("-created_at")

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Ensure we have at least 2 members total (creator + at least 1 other)
        member_ids = request.data.get("member_ids", [])
        # Normalise to ints
        try:
            ids_set = {int(i) for i in member_ids}
        except (TypeError, ValueError):
            return Response({"error": "Invalid member_ids."}, status=status.HTTP_400_BAD_REQUEST)
        ids_set.add(request.user.id)
        if len(ids_set) < 2:
            return Response(
                {"error": "A group must have at least 2 members (including yourself)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self.perform_create(serializer)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        serializer.save()

    def _is_creator(self, group):
        return group.created_by == self.request.user

    def _check_membership(self, group):
        if not group.members.filter(id=self.request.user.id).exists():
            raise PermissionDenied("You are not a member of this group.")

    def retrieve(self, request, *args, **kwargs):
        group = self.get_object()
        self._check_membership(group)
        return Response(self.get_serializer(group).data)

    @action(detail=True, methods=["post"])
    def add_member(self, request, pk=None):
        group = self.get_object()
        if not self._is_creator(group):
            return Response({"error": "Only the group creator can add members."}, status=403)
        user_id = request.data.get("user_id")
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)
        group.members.add(user)
        return Response(self.get_serializer(group).data)

    @action(detail=True, methods=["post"])
    def remove_member(self, request, pk=None):
        group = self.get_object()
        if not self._is_creator(group):
            return Response({"error": "Only the group creator can remove members."}, status=403)
        user_id = request.data.get("user_id")
        if int(user_id) == group.created_by.id:
            return Response({"error": "Creator cannot be removed from the group."}, status=400)
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=404)
        group.members.remove(user)
        return Response(self.get_serializer(group).data)


class GroupMessageListView(APIView):
    """
    GET  /groups/<group_id>/messages/ → list messages (members only)
    POST /groups/<group_id>/messages/ → send message (members only)
    """
    permission_classes = [IsAuthenticated]

    def _get_group_or_403(self, group_id):
        try:
            group = ChatGroup.objects.get(pk=group_id)
        except ChatGroup.DoesNotExist:
            return None, Response({"error": "Group not found."}, status=404)
        if not group.members.filter(id=self.request.user.id).exists():
            return None, Response({"error": "You are not a member of this group."}, status=403)
        return group, None

    def get(self, request, group_id):
        group, err = self._get_group_or_403(group_id)
        if err:
            return err
        messages = Message.objects.filter(group=group).order_by("timestamp")
        return Response(GroupMessageSerializer(messages, many=True).data)

    def post(self, request, group_id):
        group, err = self._get_group_or_403(group_id)
        if err:
            return err
        content = (request.data.get("content") or "").strip()
        if not content:
            return Response({"error": "Content is required."}, status=400)
        msg = Message.objects.create(sender=request.user, group=group, content=content)
        return Response(GroupMessageSerializer(msg).data, status=201)


# -----------------------------------------------------------------
# AI Copilot — shared rate limiter
# -----------------------------------------------------------------
from django.core.cache import cache


def _check_rate_limit(user, endpoint: str, limit: int = 20, window: int = 60) -> bool:
    key = f"ai_rl:{endpoint}:{user.id}"
    count = cache.get(key, 0)
    if count >= limit:
        return False
    cache.set(key, count + 1, timeout=window)
    return True


class AIAssistantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _check_rate_limit(request.user, "chat", limit=20, window=60):
            return Response({"error": "Rate limit exceeded."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        user_message = str(request.data.get("message", "")).strip()
        chat_history = request.data.get("history", [])
        if not user_message:
            return Response({"error": "Message is required."}, status=400)
        if len(user_message) > 2000:
            return Response({"error": "Message is too long (max 2000 characters)."}, status=400)
        if not isinstance(chat_history, list):
            chat_history = []
        response_text = generate_ai_response(request.user, user_message, chat_history)
        return Response({"response": response_text})


class AISuggestReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _check_rate_limit(request.user, "suggest", limit=10, window=60):
            return Response({"error": "Rate limit exceeded."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        messages_raw = request.data.get("messages", [])
        if not isinstance(messages_raw, list) or len(messages_raw) == 0:
            return Response({"error": "messages array is required."}, status=400)
        conversation_snippet = [str(m)[:300] for m in messages_raw if isinstance(m, str)][:10]
        suggestions = generate_suggest_replies(request.user, conversation_snippet)
        return Response({"suggestions": suggestions})


class AISummarizeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _check_rate_limit(request.user, "summarize", limit=5, window=60):
            return Response({"error": "Rate limit exceeded."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        messages_raw = request.data.get("messages", [])
        if not isinstance(messages_raw, list) or len(messages_raw) == 0:
            return Response({"error": "messages array is required."}, status=400)
        conversation_snippet = [str(m)[:300] for m in messages_raw if isinstance(m, str)][:20]
        summary = summarize_conversation(request.user, conversation_snippet)
        return Response({"summary": summary})