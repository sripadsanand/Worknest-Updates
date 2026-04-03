from datetime import date

from rest_framework import serializers

from .models import User, Task, Announcement, Message, ChatGroup


# -------------------------------------------------------------------
# Lightweight nested representation (used inside other serializers)
# -------------------------------------------------------------------
class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "seniority", "department", "avatar"]


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email",
            "role", "seniority", "section", "department",
            "avatar", "profile_image", "phone", "bio",
        ]
        read_only_fields = ["id", "username", "email", "role"]


# -------------------------------------------------------------------
# Full User serializer (used for /users/ CRUD)
# -------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    confirm_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name",
            "email", "role", "seniority", "section", "department",
            "avatar", "password", "new_password", "confirm_password",
        ]
        extra_kwargs = {
            "password": {"write_only": True},
            "new_password": {"write_only": True},
            "confirm_password": {"write_only": True},
            "email": {"required": False, "allow_blank": True},
            "first_name": {"required": False, "allow_blank": True},
            "last_name": {"required": False, "allow_blank": True},
            "section": {"required": False, "allow_blank": True},
            "avatar": {"required": False, "allow_blank": True},
        }

    def validate(self, attrs):
        new_pw = attrs.get("new_password", "")
        confirm_pw = attrs.get("confirm_password", "")
        if new_pw or confirm_pw:
            if len(new_pw) < 8:
                raise serializers.ValidationError({"new_password": "Password must be at least 8 characters."})
            if new_pw != confirm_pw:
                raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        password = attrs.get("password", "")
        if self.instance is None and password and len(password) < 8:
            raise serializers.ValidationError({"password": "Password must be at least 8 characters."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("new_password", None)
        validated_data.pop("confirm_password", None)
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        new_password = validated_data.pop("new_password", None)
        validated_data.pop("confirm_password", None)
        validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if new_password:
            instance.set_password(new_password)
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
        source="assigned_to", queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    dueDate = serializers.DateField(source="due_date", required=False, allow_null=True)

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "status", "priority",
            "dueDate", "created_at", "assigned_to", "assigned_to_id",
            "assigned_by", "created_by",
        ]
        read_only_fields = ["id", "created_at", "assigned_to", "assigned_by", "created_by"]

    def validate_dueDate(self, value):
        if value and value < date.today():
            raise serializers.ValidationError(
                "Due date cannot be in the past. Please select today or a future date."
            )
        return value


# -------------------------------------------------------------------
# Announcement
# -------------------------------------------------------------------
class AnnouncementSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Announcement
        fields = [
            "id", "title", "content", "is_high_priority",
            "audience_type", "department", "created_at", "author",
        ]
        read_only_fields = ["id", "created_at", "author"]


# -------------------------------------------------------------------
# Direct Message
# -------------------------------------------------------------------
class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    receiver = UserMinimalSerializer(read_only=True)
    receiver_id = serializers.PrimaryKeyRelatedField(
        source="receiver", queryset=User.objects.all(), write_only=True,
    )

    class Meta:
        model = Message
        fields = ["id", "sender", "receiver", "receiver_id", "content", "timestamp", "is_read"]
        read_only_fields = ["id", "timestamp", "sender", "receiver"]


# -------------------------------------------------------------------
# Group Chat
# -------------------------------------------------------------------
class ChatGroupSerializer(serializers.ModelSerializer):
    members = UserMinimalSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        source="members", queryset=User.objects.all(),
        many=True, write_only=True,
    )
    created_by = UserMinimalSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatGroup
        fields = ["id", "name", "created_by", "members", "member_ids", "member_count", "created_at"]
        read_only_fields = ["id", "created_at", "created_by", "members", "member_count"]

    def get_member_count(self, obj):
        return obj.members.count()

    def validate_member_ids(self, members):
        if len(members) < 1:
            raise serializers.ValidationError("A group must have at least 2 members (including the creator).")
        return members

    def create(self, validated_data):
        members = validated_data.pop("members", [])
        creator = self.context["request"].user
        group = ChatGroup.objects.create(created_by=creator, **validated_data)
        # Always include creator
        member_ids = {m.id for m in members}
        member_ids.add(creator.id)
        group.members.set(User.objects.filter(id__in=member_ids))
        return group


class GroupMessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "sender", "content", "timestamp", "is_read"]
        read_only_fields = ["id", "timestamp", "sender"]
