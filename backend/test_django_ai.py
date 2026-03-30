import os
import django
import sys
import json

# Setup Django context
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "worknest_backend.settings")
django.setup()

from api.models import User
from api.services.ai_service import generate_ai_response, generate_suggest_replies, summarize_conversation

def run_test():
    # Mock user if none exists
    user = User.objects.first()
    if not user:
        print("No users in DB. Mocking an object.")
        class MockUser:
            username = "TestUser"
            role = "Employee"
        user = MockUser()

    print("Testing generate_ai_response...")
    response = generate_ai_response(
        user=user,
        user_message="What are the next steps for my task?",
        chat_history=[{"role": "assistant", "content": "Hello!"}]
    )
    print("\n--- AI Response ---")
    print(response)

    print("\nTesting generate_suggest_replies...")
    replies = generate_suggest_replies(user, ["Hi there, is the server down?"])
    print("\n--- Suggested Replies ---")
    print(replies)

if __name__ == "__main__":
    run_test()
