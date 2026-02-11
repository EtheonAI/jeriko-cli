#!/usr/bin/env python3
import os
from openai import OpenAI

# Test if we can call LLM from within the sandbox
client = OpenAI()  # Uses OPENAI_API_KEY and OPENAI_BASE_URL from environment

print("Testing LLM call from within E2B sandbox...")
print(f"API Base URL: {os.environ.get('OPENAI_BASE_URL')}")
print(f"API Key (first 20 chars): {os.environ.get('OPENAI_API_KEY', '')[:20]}")

try:
    response = client.chat.completions.create(
        model="gpt-4.1-nano",
        messages=[
            {"role": "user", "content": "Say 'Hello from inside the E2B sandbox!' in exactly 5 words."}
        ],
        max_tokens=50
    )
    
    print("\n✅ SUCCESS! LLM responded:")
    print(response.choices[0].message.content)
    print(f"\nModel used: {response.model}")
    print(f"Tokens used: {response.usage.total_tokens}")
    
except Exception as e:
    print(f"\n❌ ERROR: {e}")
