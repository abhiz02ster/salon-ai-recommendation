import os
import asyncio
from typing import Optional
from google.antigravity import Agent, LocalAgentConfig
from app.config import settings
from app.agents.schemas import ClientProfileAnalysis, RecommendationListModel

async def run_stylist_agent(profile: ClientProfileAnalysis, feedback: Optional[str] = None, height: Optional[float] = None) -> RecommendationListModel:
    """
    StylistAgent: Generates 3 custom hairstyle suggestions based on the attributes and optional hairdresser feedback.
    """
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        key_path = os.path.join(settings.BACKEND_DIR, "vertex-ai-key.json")
        if os.path.exists(key_path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_path

    height_desc = f"{height} cm" if height else "Not specified"
    client_context = (
        f"Client Attributes:\n"
        f"- Gender: {profile.gender}\n"
        f"- Face Shape: {profile.face_shape}\n"
        f"- Hair Type: {profile.hair_type}\n"
        f"- Current Hair Length: {profile.hair_length}\n"
        f"- Skin Tone: {profile.skin_tone} ({profile.undertone} undertone)\n"
        f"- Ethnicity: {profile.ethnicity}\n"
        f"- Height: {height_desc}\n"
        f"- Key Profiler Observations: {profile.notes}\n"
    )

    if feedback:
        client_context += f"- Hairdresser/Client Feedback: {feedback}\n"

    system_inst = (
        "You are a master hair stylist and professional salon consultant. "
        "Your task is to generate exactly 3 custom hair styling recommendations tailored to the client's attributes. "
        "Each recommendation should perfectly complement their face shape, hair type, and characteristics. "
        "For each styling suggestion, you MUST populate: style_name, description, suitability_score, reasoning, "
        "maintenance_tips, and products_needed. Do not leave any of these keys out.\n\n"
        "IMPORTANT: You must adhere strictly to the JSON schema types:\n"
        "- suitability_score MUST be a raw floating-point number (e.g. 95.0 or 88.0, NOT a string like \"95.0%\" or \"95\").\n"
        "- reasoning MUST be a JSON array of strings containing exactly 3 separate reasons. Do NOT output a single string or markdown list.\n"
        "- maintenance_tips MUST be a JSON array of strings containing exactly 2 key tips. Do NOT output a single string.\n"
        "- products_needed MUST be a JSON array of strings containing exactly 3 recommended products. Do NOT output a single string.\n"
    )

    if feedback:
        system_inst += (
            "IMPORTANT: The hairdresser has provided feedback for refinement. You MUST adapt the recommendations "
            "to address this feedback directly (e.g. adjust length, styling, or volume as requested) while still "
            "matching the client's physical profile. Ensure you preserve their base face structure."
        )

    config = LocalAgentConfig(
        model="gemini-2.5-flash",
        response_schema=RecommendationListModel,
        system_instructions=system_inst
    )

    prompt = f"Please generate exactly 3 styling recommendations for this client, matching the schema. \n\n{client_context}"
    
    max_retries = 5
    retry_delay = 30.0
    rec_list = None
    for attempt in range(max_retries):
        try:
            print(f"DEBUG: Initiating StylistAgent (attempt {attempt + 1}/{max_retries})...")
            async with Agent(config) as agent:
                response = await agent.chat(prompt)
                recommendations_data = await response.structured_output()
                if recommendations_data is not None:
                    rec_list = RecommendationListModel.model_validate(recommendations_data)
                    break
        except Exception as e:
            print(f"WARNING: StylistAgent call failed on attempt {attempt + 1}: {e}")
        
        print(f"WARNING: StylistAgent returned None or failed on attempt {attempt + 1}. Retrying in {retry_delay}s...")
        await asyncio.sleep(retry_delay)

    if rec_list is None:
        raise RuntimeError(
            "StylistAgent failed to generate valid structured output after multiple retries. "
            "This is typically due to rate limits or API service issues."
        )

    print(f"DEBUG: StylistAgent finished. Generated {len(rec_list.recommendations)} recommendations.")
    return rec_list
