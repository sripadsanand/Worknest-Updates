import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

env_path = BASE_DIR / ".env"
print("env_path exists:", env_path.exists())
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key] = val

print("OPENAI_API_KEY length:", len(os.environ.get("OPENAI_API_KEY", "")))

from openai import OpenAI
try:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    print("OpenAI client initialized.")
    resp = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=5
    )
    print("Response successful:", resp.choices[0].message.content)
except Exception as e:
    print("OpenAI Error:", type(e).__name__, str(e))
