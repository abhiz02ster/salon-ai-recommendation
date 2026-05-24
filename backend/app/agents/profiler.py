import os
import asyncio
from google.antigravity import Agent, LocalAgentConfig
from google.antigravity.types import Image
from app.config import settings
from app.agents.schemas import ClientProfileAnalysis

async def run_profiler_agent(front_bytes: bytes, left_bytes: bytes, right_bytes: bytes) -> ClientProfileAnalysis:
    """
    ProfilerAgent: Analyzes the client's hair/face profile from three viewpoints (Front, Left, Right).
    Uses google-antigravity Agent with structured output response_schema.
    """
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        key_path = os.path.join(settings.BACKEND_DIR, "vertex-ai-key.json")
        if os.path.exists(key_path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_path

    config = LocalAgentConfig(
        model="gemini-2.5-flash",
        response_schema=ClientProfileAnalysis,
        system_instructions=(
            "You are a professional hair salon AI face profiler. "
            "Your job is to analyze the 3 photos of the client (Front, Left Profile, Right Profile) "
            "and identify their gender, face shape, hair type, hair length, skin tone, undertone, "
            "and ethnicity. Assess their look carefully from all three angles to capture a complete profile.\n"
            "IMPORTANT: All confidence score fields (gender_confidence, face_confidence, hair_confidence, "
            "skin_confidence, ethnicity_confidence) MUST be raw floating-point numbers between 0.0 and 1.0 "
            "(do NOT output strings or percentages). Notes must be a plain string."
        )
    )

    images_input = []
    if front_bytes:
        images_input.append(Image(data=front_bytes, mime_type="image/jpeg", description="Front view"))
    if left_bytes:
        images_input.append(Image(data=left_bytes, mime_type="image/jpeg", description="Left profile view"))
    if right_bytes:
        images_input.append(Image(data=right_bytes, mime_type="image/jpeg", description="Right profile view"))

    prompt = [
        "Please analyze this client's profile from the front, left, and right viewpoints. "
        "Fill in the client profile analysis schema based on your observations.",
    ]
    prompt.extend(images_input)

    max_retries = 5
    retry_delay = 30.0
    profile_obj = None
    for attempt in range(max_retries):
        try:
            print(f"DEBUG: Initiating ProfilerAgent (attempt {attempt + 1}/{max_retries})...")
            async with Agent(config) as agent:
                response = await agent.chat(prompt)
                profile_data = await response.structured_output()
                if profile_data is not None:
                    profile_obj = ClientProfileAnalysis.model_validate(profile_data)
                    break
        except Exception as e:
            print(f"WARNING: ProfilerAgent call failed on attempt {attempt + 1}: {e}")
        
        print(f"WARNING: ProfilerAgent returned None or failed on attempt {attempt + 1}. Retrying in {retry_delay}s...")
        await asyncio.sleep(retry_delay)

    if profile_obj is None:
        raise RuntimeError(
            "ProfilerAgent failed to generate valid structured output after multiple retries. "
            "This is typically due to rate limits or API service issues."
        )

    print(f"DEBUG: ProfilerAgent finished. Detected Face Shape: {profile_obj.face_shape}, Ethnicity: {profile_obj.ethnicity}")
    return profile_obj
