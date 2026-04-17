from django.urls import path, include
from django.http import JsonResponse
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    UserViewSet,
    TaskViewSet,
    AnnouncementViewSet,
    MessageViewSet,
    ChatGroupViewSet,
    GroupMessageListView,
    CurrentUserView,
    UserProfileView,
    ChatHistoryView,
    AIAssistantView,
    AISuggestReplyView,
    AISummarizeView,
    DepartmentSectionsView,
    DepartmentUsersView,
)


def test_api_endpoint(request):
    return JsonResponse({"message": "API is working successfully!", "status": "ok"})


router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'announcements', AnnouncementViewSet, basename='announcement')
router.register(r'messages', MessageViewSet, basename='message')
router.register(r'groups', ChatGroupViewSet, basename='group')

urlpatterns = [
    # ── JWT Auth ───────────────────────────────────────────────────────
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ── Current user / profile ─────────────────────────────────────────
    path('users/me/', CurrentUserView.as_view(), name='users-me'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),

    # ── 1-to-1 chat history (REST) ────────────────────────────────────
    path('chat/history/', ChatHistoryView.as_view(), name='chat-history'),

    # ── Group messages ────────────────────────────────────────────────
    path('groups/<int:group_id>/messages/', GroupMessageListView.as_view(), name='group-messages'),

    # ── AI Copilot ────────────────────────────────────────────────────
    path('ai/chat/', AIAssistantView.as_view(), name='api-ai-chat'),
    path('ai/suggest-reply/', AISuggestReplyView.as_view(), name='api-ai-suggest'),
    path('ai/summarize/', AISummarizeView.as_view(), name='api-ai-summarize'),

    # ── Utility ───────────────────────────────────────────────────────
    path('departments/<str:department>/sections/', DepartmentSectionsView.as_view(), name='department-sections'),
    path('departments/<str:department>/users/', DepartmentUsersView.as_view(), name='department-users'),

    # ── Health check ──────────────────────────────────────────────────
    path('test/', test_api_endpoint, name='api-test'),

    # ── ViewSet routes (router must come LAST) ─────────────────────────
    path('', include(router.urls)),
]
