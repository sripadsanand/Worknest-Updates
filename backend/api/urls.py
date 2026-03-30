from django.urls import path, include
from django.http import JsonResponse
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    UserViewSet,
    TaskViewSet,
    AnnouncementViewSet,
    MessageViewSet,
    CurrentUserView,
    UserProfileView,
    ChatHistoryView,
    AIAssistantView,
    AISuggestReplyView,
    AISummarizeView,
)

def test_api_endpoint(request):
    return JsonResponse({"message": "API is working successfully!", "status": "ok"})

router = routers.DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'announcements', AnnouncementViewSet)
router.register(r'messages', MessageViewSet, basename='message')

# ⚠️  IMPORTANT: All custom/non-router paths MUST come BEFORE include(router.urls)
# The DRF DefaultRouter will absorb unmatched paths otherwise.
urlpatterns = [
    # ── JWT Auth ───────────────────────────────────────────────────────
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # ── Current user profile  (must be before the router to avoid <pk> swallowing 'me') ──
    path('users/me/', CurrentUserView.as_view(), name='users-me'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),

    # ── 1-to-1 chat history (REST) ────────────────────────────────────
    path('chat/history/', ChatHistoryView.as_view(), name='chat-history'),

    # ── AI Copilot ────────────────────────────────────────────────────
    path('ai/chat/', AIAssistantView.as_view(), name='api-ai-chat'),
    path('ai/suggest-reply/', AISuggestReplyView.as_view(), name='api-ai-suggest'),
    path('ai/summarize/', AISummarizeView.as_view(), name='api-ai-summarize'),

    # ── Health check ──────────────────────────────────────────────────
    path('test/', test_api_endpoint, name='api-test'),

    # ── ViewSet routes (router must come LAST) ─────────────────────────
    path('', include(router.urls)),
]
