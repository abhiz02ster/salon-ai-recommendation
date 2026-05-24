import io
import os
import asyncio
from typing import Optional
from PIL import Image
from datetime import datetime
from app.config import settings
import app.database as database
import app.agents as agents
import app.services.media as media
from app.api.schemas import ClientAttributes, HairRecommendation, RecommendationResponse

async def analyze_and_recommend(
    front_bytes: bytes,
    left_bytes: Optional[bytes],
    right_bytes: Optional[bytes],
    height: Optional[str],
    client_id: Optional[int]
) -> RecommendationResponse:
    """
    Orchestrate the analyze-and-recommend pipeline:
    1. Save client photos to disk (getting portable relative paths)
    2. Execute ProfilerAgent to extract profile attributes
    3. Execute StylistAgent to generate recommendations
    4. Concurrently generate Imagen visualizations and Veo try-on videos
    5. Save consultation session in database
    """
    # Save photos to disk (portable relative paths)
    saved_paths = database.save_photos(front_bytes, left_bytes, right_bytes)
    
    # Initialize PIL image for original front photo (required for styling fallback)
    front_image_pil = Image.open(io.BytesIO(front_bytes))
    if front_image_pil.mode != "RGB":
        front_image_pil = front_image_pil.convert("RGB")

    # Parse height
    client_height = None
    if height:
        try:
            client_height = float(height)
        except ValueError:
            pass

    # Run Profiler Agent to extract physical attributes
    profile = await agents.run_profiler_agent(front_bytes, left_bytes, right_bytes)
    
    # Run Stylist Agent to generate styling recommendations
    rec_list = await agents.run_stylist_agent(profile, feedback=None, height=client_height)
    
    # Format recommendations to response models
    recommendations = []
    for item in rec_list.recommendations:
        rec = HairRecommendation(
            style_name=item.style_name,
            description=item.description,
            suitability_score=item.suitability_score,
            reasoning=item.reasoning,
            maintenance_tips=item.maintenance_tips,
            products_needed=item.products_needed,
            visualization_url=None,
            video_url=None
        )
        recommendations.append(rec)

    # Build client attributes object
    client_attrs = ClientAttributes(
        height=client_height,
        gender=profile.gender,
        face_shape=profile.face_shape,
        body_type="mesomorph",
        hair_type=profile.hair_type,
        hair_length=profile.hair_length,
        skin_tone=profile.skin_tone,
        ethnicity=profile.ethnicity
    )

    # Define parallel media generators
    async def get_viz(rec_item):
        try:
            viz_url = await asyncio.to_thread(
                media.generate_hairstyle_visualization,
                front_image_pil,
                rec_item.style_name,
                rec_item.description,
                client_attrs
            )
            rec_item.visualization_url = viz_url
        except Exception as e:
            print(f"Error generating viz: {e}")

    async def get_video(rec_item):
        try:
            video_url = await asyncio.to_thread(
                media.generate_veo_video,
                rec_item.style_name,
                rec_item.description,
                client_attrs
            )
            rec_item.video_url = video_url
        except Exception as e:
            print(f"Error generating video: {e}")

    # Build concurrent tasks (3 visual images + 1 Veo video try-on for highest scoring suggestion)
    tasks = []
    for idx, rec in enumerate(recommendations):
        tasks.append(get_viz(rec))
        if idx == 0:
            tasks.append(get_video(rec))

    print("DEBUG: Generating media assets concurrently...")
    await asyncio.gather(*tasks)

    # Format analysis details dictionary
    analysis_details = {
        "gender_analysis": {
            "detected_gender": profile.gender,
            "confidence": profile.gender_confidence,
            "notes": profile.notes
        },
        "face_analysis": {
            "detected_shape": profile.face_shape,
            "confidence": profile.face_confidence,
            "notes": profile.notes
        },
        "hair_analysis": {
            "detected_type": profile.hair_type,
            "detected_length": profile.hair_length,
            "confidence": profile.hair_confidence,
            "notes": profile.notes
        },
        "skin_analysis": {
            "detected_tone": profile.skin_tone,
            "detected_undertone": profile.undertone,
            "confidence": profile.skin_confidence,
            "notes": profile.notes
        },
        "ethnicity_analysis": {
            "detected_ethnicity": profile.ethnicity,
            "confidence": profile.ethnicity_confidence,
            "notes": profile.notes
        },
        "client_attributes": client_attrs.model_dump()
    }

    # Initialize history list
    initial_history = [
        {"role": "user", "content": "Initial styling consultation based on multi-angle client photos"},
        {
            "role": "assistant",
            "profile": profile.model_dump(),
            "recommendations": [r.model_dump() for r in recommendations]
        }
    ]

    # Save to SQLite database
    cid = client_id if client_id else 1
    consultation_id = database.create_consultation(
        client_id=cid,
        photos=saved_paths,
        recommendations={
            "recommendations": [r.model_dump() for r in recommendations],
            "analysis_details": analysis_details
        },
        conversation_history=initial_history
    )

    return RecommendationResponse(
        recommendations=recommendations,
        analysis_details=analysis_details,
        timestamp=datetime.utcnow().isoformat(),
        consultation_id=consultation_id
    )

async def refine_recommendations(consultation_id: int, feedback: str) -> RecommendationResponse:
    """
    Orchestrate the refine pipeline:
    1. Fetch original consultation from database
    2. Re-instantiate profile analysis attributes
    3. Execute StylistAgent with client attributes & hairdresser feedback
    4. Concurrently generate updated styling visualizations
    5. Update consultation session record with history and updated suggestions
    """
    # Fetch existing consultation
    consultation = database.get_consultation(consultation_id)
    if not consultation:
        raise ValueError("Consultation not found")

    rec_data = consultation["recommendations"]
    client_attrs_raw = rec_data["analysis_details"]["client_attributes"]
    
    # Re-create client profile analysis model
    profile = agents.ClientProfileAnalysis(
        gender=client_attrs_raw.get("gender", "female"),
        gender_confidence=1.0,
        face_shape=client_attrs_raw.get("face_shape", "oval"),
        face_confidence=1.0,
        hair_type=client_attrs_raw.get("hair_type", "straight"),
        hair_confidence=1.0,
        hair_length=client_attrs_raw.get("hair_length", "medium"),
        skin_tone=client_attrs_raw.get("skin_tone", "medium"),
        skin_confidence=1.0,
        undertone=client_attrs_raw.get("undertone", "neutral"),
        ethnicity=client_attrs_raw.get("ethnicity", "South Asian"),
        ethnicity_confidence=1.0,
        notes="Refined based on feedback."
    )
    
    client_height = client_attrs_raw.get("height")
    
    # Run Stylist Agent with hairdresser feedback
    result = await agents.run_stylist_agent(profile, feedback, client_height)
    
    # Format recommendations
    recommendations = []
    for item in result.recommendations:
        rec = HairRecommendation(
            style_name=item.style_name,
            description=item.description,
            suitability_score=item.suitability_score,
            reasoning=item.reasoning,
            maintenance_tips=item.maintenance_tips,
            products_needed=item.products_needed,
            visualization_url=None,
            video_url=None
        )
        recommendations.append(rec)

    # Locate and resolve original front photo path absolutely
    front_image_pil = None
    photos_paths = consultation["photos"]
    if "front" in photos_paths:
        front_path = photos_paths["front"]
        if not os.path.isabs(front_path):
            front_path = os.path.abspath(os.path.join(settings.BACKEND_DIR, front_path))
            
        if os.path.exists(front_path):
            front_image_pil = Image.open(front_path)
            if front_image_pil.mode != "RGB":
                front_image_pil = front_image_pil.convert("RGB")
                
    if front_image_pil is None:
        front_image_pil = Image.new("RGB", (256, 256), color="white")

    client_attrs = ClientAttributes(
        height=client_height,
        gender=profile.gender,
        face_shape=profile.face_shape,
        body_type="mesomorph",
        hair_type=profile.hair_type,
        hair_length=profile.hair_length,
        skin_tone=profile.skin_tone,
        ethnicity=profile.ethnicity
    )

    # Define parallel media generators
    async def get_viz(rec_item):
        try:
            viz_url = await asyncio.to_thread(
                media.generate_hairstyle_visualization,
                front_image_pil,
                rec_item.style_name,
                rec_item.description,
                client_attrs
            )
            rec_item.visualization_url = viz_url
        except Exception as e:
            print(f"Error generating viz: {e}")

    async def get_video(rec_item):
        try:
            video_url = await asyncio.to_thread(
                media.generate_veo_video,
                rec_item.style_name,
                rec_item.description,
                client_attrs
            )
            rec_item.video_url = video_url
        except Exception as e:
            print(f"Error generating video: {e}")

    # Build concurrent tasks
    tasks = []
    for idx, rec in enumerate(recommendations):
        tasks.append(get_viz(rec))
        if idx == 0:
            tasks.append(get_video(rec))

    print("DEBUG: Generating refined media assets concurrently...")
    await asyncio.gather(*tasks)

    # Build update response
    response_data = RecommendationResponse(
        recommendations=recommendations,
        analysis_details=rec_data["analysis_details"],
        timestamp=datetime.utcnow().isoformat(),
        consultation_id=consultation_id
    )

    # Update conversation history
    history = consultation["conversation_history"]
    history.append({
        "role": "user",
        "content": feedback
    })
    history.append({
        "role": "assistant",
        "recommendations": response_data.model_dump()
    })

    database.update_consultation_history(
        consultation_id,
        response_data.model_dump(),
        history
    )

    return response_data
