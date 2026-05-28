import os
import asyncio
from typing import Optional
from google.antigravity import Agent, LocalAgentConfig
from app.config import settings
from app.agents.schemas import ClientProfileAnalysis, RecommendationListModel, HairRecommendationModel

async def run_stylist_agent(profile: ClientProfileAnalysis, feedback: Optional[str] = None) -> RecommendationListModel:
    """
    StylistAgent: Generates 3 custom hairstyle suggestions based on the attributes and optional hairdresser feedback.
    """
    if settings.MOCK_MEDIA:
        print("DEBUG: MOCK_MEDIA is active. Returning mock RecommendationListModel immediately.")
        desc1 = "Modern Textured Tapered Fade"
        desc2 = "Classic Curly Bob with Fringe"
        desc3 = "Long Layers with Soft Waves"
        
        if feedback:
            desc1 += f" (refined: {feedback})"
            desc2 += f" (refined: {feedback})"
            desc3 += f" (refined: {feedback})"
            
        return RecommendationListModel(
            recommendations=[
                HairRecommendationModel(
                    style_name="Modern Textured Tapered Fade" if not feedback else "Refined Modern Textured Tapered Fade",
                    description=f"A modern textured tapered fade that accentuates the oval face shape. Features soft texture on top with clean tapered sides. {feedback if feedback else ''}",
                    suitability_score=95.0,
                    reasoning=[
                        "Accentuates the natural curls and texture.",
                        "Tapered sides complement the oval face structure.",
                        "Textured top allows for versatile styling options."
                    ],
                    maintenance_tips=[
                        "Use a curling cream to define texture daily.",
                        "Trim every 3-4 weeks to maintain the fade."
                    ],
                    products_needed=[
                        "Curling Cream",
                        "Matte Clay",
                        "Argan Oil"
                    ]
                ),
                HairRecommendationModel(
                    style_name="Classic Curly Bob with Fringe",
                    description=f"A classic curly bob with a light fringe that frame the face beautifully. Fits curly hair types perfectly. {feedback if feedback else ''}",
                    suitability_score=88.0,
                    reasoning=[
                        "Brings out the volume of curly hair.",
                        "Soft fringe frames the forehead nicely.",
                        "Medium length balances the facial features."
                    ],
                    maintenance_tips=[
                        "Diffuse dry on low heat to keep curls bouncy.",
                        "Apply leave-in conditioner to prevent frizz."
                    ],
                    products_needed=[
                        "Leave-in Conditioner",
                        "Styling Gel",
                        "Volumizing Mousse"
                    ]
                ),
                HairRecommendationModel(
                    style_name="Long Layers with Soft Waves",
                    description=f"Long cascading layers designed to add movement and dimension to curls. {feedback if feedback else ''}",
                    suitability_score=85.0,
                    reasoning=[
                        "Long layers reduce bulk and shape the curls.",
                        "Adds beautiful movement and bounce.",
                        "Frames the jawline elegantly."
                    ],
                    maintenance_tips=[
                        "Co-wash every other day to preserve moisture.",
                        "Deep condition weekly to protect curly ends."
                    ],
                    products_needed=[
                        "Deep Conditioner",
                        "Defining Gel",
                        "Co-wash Conditioner"
                    ]
                )
            ]
        )

    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        key_path = os.path.join(settings.BACKEND_DIR, "vertex-ai-key.json")
        if os.path.exists(key_path):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = key_path

    client_context = (
        f"Client Attributes:\n"
        f"- Gender: {profile.gender}\n"
        f"- Face Shape: {profile.face_shape}\n"
        f"- Hair Type: {profile.hair_type}\n"
        f"- Current Hair Length: {profile.hair_length}\n"
        f"- Skin Tone: {profile.skin_tone} ({profile.undertone} undertone)\n"
        f"- Ethnicity: {profile.ethnicity}\n"
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
