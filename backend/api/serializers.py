from rest_framework import serializers

from .models import User, Task, Announcement, Message


# -------------------------------------------------------------------
# Lightweight nested representation (used inside other serializers)
# -------------------------------------------------------------------
class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "department", "avatar"]

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "role", "department", "avatar", "profile_image", "phone", "bio"]
        read_only_fields = ["id", "username", "email", "role"]


# -------------------------------------------------------------------
# Full User serializer (used for /users/ CRUD)
# -------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name",
            "email", "role", "department", "avatar", "password",
        ]
        extra_kwargs = {
            "password": {"write_only": True},
            "email": {"required": False, "allow_blank": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
            "department": {"required": False, "allow_blank": True},
            "avatar": {"required": False, "allow_blank": True},
        }

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


# -------------------------------------------------------------------
# Task
# -------------------------------------------------------------------
class TaskSerializer(serializers.ModelSerializer):
    assigned_to = UserMinimalSerializer(read_only=True)
    assigned_by = UserMinimalSerializer(read_only=True)
    created_by = UserMinimalSerializer(source="assigned_by", read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source="assigned_to",
        queryset=User.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )
    # Frontend uses camelCase dueDate, so expose via source mapping
    dueDate = serializers.DateField(source="due_date", required=False, allow_null=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "dueDate",
            "created_at",
            "assigned_to",
            "assigned_to_id",
            "assigned_by",
            "created_by",
        ]
        read_only_fields = ["id", "created_at", "assigned_to", "assigned_by", "created_by"]


# -------------------------------------------------------------------
# Announcement
# -------------------------------------------------------------------
class AnnouncementSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id",
            "title",
            "content",
            "is_high_priority",
            "created_at",
            "author",
        ]
        read_only_fields = ["id", "created_at", "author"]


# -------------------------------------------------------------------
# Direct Message
# -------------------------------------------------------------------
class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    receiver = UserMinimalSerializer(read_only=True)
    receiver_id = serializers.PrimaryKeyRelatedField(
        source="receiver",
        queryset=User.objects.all(),
        write_only=True,
    )

    class Meta:
        model = Message
        fields = [
            "id",
            "sender",
            "receiver",
            "receiver_id",
            "content",
            "timestamp",
            "is_read",
        ]
        read_only_fields = ["id", "timestamp", "sender", "receiver"]
