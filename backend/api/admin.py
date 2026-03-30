from django.contrib import admin
from .models import User, Task, Announcement, Message
@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'role', 'is_staff')
    list_filter = ('role', 'is_staff')

# Register the Task model
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'assigned_to', 'status', 'due_date')
    list_filter = ('status', 'assigned_to')

# Register other models
admin.site.register(Announcement)
admin.site.register(Message)