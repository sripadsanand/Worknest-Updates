import os
import requests
import json

api_key = os.environ.get("HF_API_KEY", "hf_xxxxxxx")

def try_model(model_name):
    url = "https://router.huggingface.co/hf-inference/v1/chat/completions" # wait, earlier I got 404 for hf-inference/v1/chat/completions
    url = "https://router.huggingface.co/v1/chat/completions" # this one worked (400 instead of 404)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 10
    }
    result = f"Trying {model_name} ...\n"
    try:
        r = requests.post(url, headers=headers, json=data, timeout=10)
        result += f"Status: {r.status_code}\n"
        if r.status_code == 200:
            result += f"Success! {json.dumps(r.json())[:100]}\n"
        else:
            result += f"Error: {r.text[:200]}\n"
    except Exception as e:
        result += f"Failed: {e}\n"
    return result

models = [
    "meta-llama/Llama-3.2-3B-Instruct",
    "Qwen/Qwen2.5-72B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "01-ai/Yi-1.5-34B-Chat",
]

with open("hf_test_models.txt", "w") as f:
    for m in models:
        f.write(try_model(m) + "-"*40 + "\n")
