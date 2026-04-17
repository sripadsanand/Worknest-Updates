from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    class Roles(models.TextChoices):
        ADMIN = "Admin", "Admin"
        MANAGER = "Manager", "Manager"
        EMPLOYEE = "Employee", "Employee"

    class Seniority(models.TextChoices):
        SENIOR = "Senior", "Senior"
        JUNIOR = "Junior", "Junior"

    class Department(models.TextChoices):
        HR = "HR", "HR"
        IT = "IT", "IT"
        FINANCE = "FINANCE", "Finance"

    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.EMPLOYEE)
    seniority = models.CharField(max_length=10, choices=Seniority.choices, default=Seniority.JUNIOR)
    section = models.CharField(max_length=100, blank=True, default="")
    department = models.CharField(max_length=20, choices=Department.choices, default=Department.HR)
    avatar = models.URLField(blank=True, default="")
    profile_image = models.ImageField(upload_to='profiles/', null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True, default="")
    bio = models.TextField(blank=True, default="")
    manager = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates'
    )

    def __str__(self):
        return f"{self.username} ({self.role})"


class Task(models.Model):
    class Status(models.TextChoices):
        TODO = "todo", "To Do"
        IN_PROGRESS = "inprogress", "In Progress"
        DONE = "done", "Done"

    class Priority(models.TextChoices):
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="tasks",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="assigned_tasks",
    )
    assigned_to_department = models.CharField(
        max_length=20, choices=settings.AUTH_USER_MODEL.__class__.Department.choices if False else [
            ('HR', 'HR'), ('IT', 'IT'), ('FINANCE', 'Finance')
        ], null=True, blank=True
    )
    assigned_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="department_tasks", blank=True
    )

    def __str__(self):
        return self.title


class Announcement(models.Model):
    class AudienceType(models.TextChoices):
        ALL = "All", "All"
        SENIOR = "Senior", "Senior Only"
        JUNIOR = "Junior", "Junior Only"

    class Department(models.TextChoices):
        HR = "HR", "HR"
        IT = "IT", "IT"
        FINANCE = "FINANCE", "Finance"

    title = models.CharField(max_length=255)
    content = models.TextField()
    is_high_priority = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    audience_type = models.CharField(
        max_length=10, choices=AudienceType.choices, default=AudienceType.ALL,
    )
    department = models.CharField(
        max_length=20, choices=Department.choices, default=Department.HR,
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="announcements",
    )

    def __str__(self):
        return self.title


# ─────────────────────────────────────────────────────────────────────
# Group Chat
# ─────────────────────────────────────────────────────────────────────

class ChatGroup(models.Model):
    """A named group that can have many members and group messages."""
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="created_groups",
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="chat_groups", blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Message(models.Model):
    """
    Unified message model.
    - Direct message:  receiver set, group is None.
    - Group message:   group set, receiver is None.
    Exactly one of (receiver, group) should be non-null.
    """
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_messages",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True, related_name="received_messages",
    )
    group = models.ForeignKey(
        ChatGroup, on_delete=models.CASCADE,
        null=True, blank=True, related_name="messages",
    )
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        if self.group:
            return f"[Group:{self.group.name}] {self.sender}: {self.content[:40]}"
        return f"[DM] {self.sender} → {self.receiver}: {self.content[:40]}"


class RoomMessage(models.Model):
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="room_messages",
    )
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"RoomMessage {self.id} from {self.sender} at {self.timestamp}"
