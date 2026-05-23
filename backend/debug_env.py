#!/usr/bin/env python3
"""Debug script to check environment loading"""

import os
from dotenv import load_dotenv

# Load environment variables
print("Loading .env file...")
load_dotenv()

print("Environment variables:")
print(f"GEMINI_API_KEY: {os.getenv('GEMINI_API_KEY')}")
print(f"USE_VERTEX_AI: {os.getenv('USE_VERTEX_AI')}")
print(f"VERTEX_AI_PROJECT: {os.getenv('VERTEX_AI_PROJECT')}")
print(f"VERTEX_AI_LOCATION: {os.getenv('VERTEX_AI_LOCATION')}")

# Check how they're being processed
use_vertex_ai = os.getenv("USE_VERTEX_AI", "false").lower() == "true"
print(f"USE_VERTEX_AI processed: {use_vertex_ai}")
print(f"Type of USE_VERTEX_AI raw: {type(os.getenv('VERTEX_AI_PROJECT'))}")

vertex_ai_project = os.getenv("VERTEX_AI_PROJECT")
print(f"VERTEX_AI_PROJECT: '{vertex_ai_project}'")
print(f"VERTEX_AI_PROJECT is None: {vertex_ai_project is None}")
print(f"VERTEX_AI_PROJECT == '': {vertex_ai_project == ''}")
print(f"bool(VERTEX_AI_PROJECT): {bool(vertex_ai_project)}")