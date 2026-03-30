"""
WorkNest AI Copilot Service (Hugging Face)

Powered by: Qwen/Qwen2.5-72B-Instruct (via Hugging Face Inference Router)
Format: OpenAI-compatible Chat Completions API
"""

import os
import json
import logging
import requests
from django.conf import settings
from ..models import Task, Announcement

logger = logging.getLogger(__name__)

# ─── Constants ────────────────────────────────────────────────────────────────
MAX_HISTORY_TURNS = 6        # Keep last 6 user/assistant exchanges
MAX_CONTEXT_TOKENS = 500     # Budget for workspace context
HF_MODEL = "Qwen/Qwen2.5-72B-Instruct"
# Note: HF free inference router models can change. Good alternatives:
# "meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mistral-Nemo-Instruct-2407"
HF_API_URL = "https://router.huggingface.co/v1/chat/completions"
REQUEST_TIMEOUT = 30         # seconds

BLOCKED_PATTERNS = [
    "ignore previous", "ignore all instructions", "disregard your",
    "you are now", "pretend you are", "jailbreak", "developer mode"
]

ROLE_INSTRUCTIONS = {
    "Admin": (
        "You are assisting an Admin. Help with: monitoring team activity, "
        "drafting company announcements, summarizing all tasks across the org, "
        "and providing high-level strategic insights. Be concise and executive-level."
    ),
    "Manager": (
        "You are assisting a Manager. Help with: assigning and prioritizing tasks, "
        "summarizing team progress, generating task instructions for employees, "
        "and drafting internal updates. Be practical and action-oriented."
    ),
    "Employee": (
        "You are assisting an Employee. Help with: understanding assigned tasks, "
        "drafting professional replies, asking for clarification, "
        "and managing personal workload. Be friendly, helpful, and clear."
    ),
}

FALLBACK_MESSAGES = {
    "Admin": "I'm offline. Check the Task Board or Post an Announcement.\n_Configure HF_API_KEY._",
    "Manager": "I'm offline. Assign tasks or message your team.\n_Configure HF_API_KEY._",
    "Employee": "I'm offline. Check your tasks or message your manager.\n_Admin needs to configure HF_API_KEY._"
}


# ─── Helpers ──────────────────────────────────────────────────────────────────
def sanitize_input(text: str) -> str:
    text = text.strip()[:1500]
    lower = text.lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern in lower:
            raise ValueError("Message contains disallowed content.")
    return text


def build_workspace_context(user) -> str:
    tasks = Task.objects.filter(assigned_to=user).exclude(status="done").order_by("due_date")[:5]
    announcements = Announcement.objects.all().order_by("-created_at")[:3]

    lines = [f"User: {user.username} | Role: {user.role}"]

    if tasks.exists():
        lines.append("\nActive Tasks:")
        for t in tasks:
            lines.append(f"- [{t.priority.upper()}] {t.title} ({t.status})")
    else:
        lines.append("\nActive Tasks: None.")

    if announcements.exists():
        lines.append("\nRecent Announcements:")
        for a in announcements:
            author = a.author.username if a.author else "System"
            lines.append(f"- {'[URGENT] ' if a.is_high_priority else ''}{a.title} (by {author})")

    return "\n".join(lines)[:MAX_CONTEXT_TOKENS]


def build_system_prompt(user) -> str:
    role_instruction = ROLE_INSTRUCTIONS.get(user.role, ROLE_INSTRUCTIONS["Employee"])
    workspace_ctx = build_workspace_context(user)
    return f"""You are WorkNest AI Copilot, a professional workplace assistant embedded in a collaboration platform.
{role_instruction}
Be concise. Use markdown formatting. Do NOT make up facts.

=== CONTEXT ===
{workspace_ctx}
==============="""


# ─── HuggingFace Engine ───────────────────────────────────────────────────────
def _call_huggingface(messages: list, max_tokens: int = 400, temperature: float = 0.6) -> str:
    api_key = os.environ.get("HF_API_KEY", "")
    if not api_key:
        logger.warning("[AI] HF_API_KEY is missing from environment.")
        return ""

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": HF_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": 0.9,
    }

    try:
        resp = requests.post(HF_API_URL, headers=headers, json=payload, timeout=REQUEST_TIMEOUT)
        
        if resp.status_code == 200:
            data = resp.json()
            if "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0].get("message", {}).get("content", "").strip()
        elif resp.status_code == 503:
            logger.warning("[AI] Model is loading (503).")
        else:
            logger.error(f"[AI] API Error {resp.status_code}: {resp.text}")
    except requests.exceptions.Timeout:
        logger.error("[AI] Request timed out.")
    except Exception as e:
        logger.error(f"[AI] Request failed: {e}")

    return ""


# ─── Endpoints logic ──────────────────────────────────────────────────────────
def generate_ai_response(user, user_message: str, chat_history: list) -> str:
    try:
        user_message = sanitize_input(user_message)
    except ValueError as e:
        return f"⚠️ {e} Please rephrase."

    system_prompt = build_system_prompt(user)

    # Trim history and prepare messages array for OpenAI-compatible endpoint
    valid_history = [{"role": m.get("role"), "content": m.get("content")} 
                     for m in chat_history 
                     if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")]
    
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(valid_history[-(MAX_HISTORY_TURNS * 2):])
    messages.append({"role": "user", "content": user_message})

    result = _call_huggingface(messages, max_tokens=500, temperature=0.6)
    return result if result else FALLBACK_MESSAGES.get(user.role, FALLBACK_MESSAGES["Employee"])


def generate_suggest_replies(user, conversation_snippet: list) -> list:
    if not conversation_snippet:
        return ["Got it!", "Thanks.", "I'll look into this."]

    convo_text = "\n".join(conversation_snippet[-6:])
    system_prompt = (
        f"You are helping {user.username} ({user.role}) write a quick, natural reply to this chat.\n"
        "Generate EXACTLY 3 short suggestions (max 10 words each). "
        "Return ONLY a valid JSON array of strings (e.g. [\"Reply 1\", \"Reply 2\", \"Reply 3\"]). "
        "Do not include markdown blocks or any other text."
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Chat:\n{convo_text}\n\nSuggest 3 replies in JSON array format:"}
    ]

    raw = _call_huggingface(messages, max_tokens=150, temperature=0.5)
    
    if raw:
        try:
            # Attempt to parse json directly
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start != -1 and end > start:
                suggestions = json.loads(raw[start:end])
                if isinstance(suggestions, list):
                    return [str(s).strip()[:40] for s in suggestions[:3]]
        except (json.JSONDecodeError, ValueError):
            pass
        
        # Fallback parsing if model ignores json instruction
        lines = [l.strip().lstrip("•-123. \",") for l in raw.strip().split("\n") if l.strip()]
        valid = [l for l in lines if len(l) > 2 and not l.startswith("[") and not l.startswith("]")]
        if valid:
            return valid[:3]

    return ["Got it, thanks!", "Let me check.", "Sounds good."]


def summarize_conversation(user, messages_text: list) -> str:
    convo = "\n".join(messages_text[-15:])
    system_prompt = "Summarize the following workplace chat in 3 concise bullet points. Be brief and professional. Provide only the bullet points."
    
    msgs = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Chat:\n{convo}\n\nSummarize:"}
    ]

    result = _call_huggingface(msgs, max_tokens=250, temperature=0.3)
    return result if result else "Unable to summarize at the moment."
