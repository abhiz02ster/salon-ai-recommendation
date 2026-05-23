"""
Salon AI Hair Styling Recommendation System
Backend API using FastAPI with Google Gemini Flash 2.5 for analysis
Vertex AI for image generation capabilities
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
import numpy as np
from PIL import Image
import io
import base64
import os
import time
from datetime import datetime
from google import genai
from dotenv import load_dotenv

# Vertex AI initialization using modern google-genai SDK
from google.genai import types

load_dotenv()
print("DEBUG: Environment variables loaded")

USE_VERTEX_AI = os.getenv("USE_VERTEX_AI", "true").lower() == "true"
VERTEX_AI_PROJECT = os.getenv("VERTEX_AI_PROJECT")
VERTEX_AI_LOCATION = os.getenv("VERTEX_AI_LOCATION", "us-central1")
print(f"DEBUG: USE_VERTEX_AI={USE_VERTEX_AI}, VERTEX_AI_PROJECT={VERTEX_AI_PROJECT}, VERTEX_AI_LOCATION={VERTEX_AI_LOCATION}")

vertex_client = None
vertex_ai_available = False

if USE_VERTEX_AI and VERTEX_AI_PROJECT:
    try:
        # Initialize unified google-genai client with Vertex AI mode enabled
        # This resolves deprecation warnings by avoiding the legacy vertexai SDK classes
        vertex_client = genai.Client(
            vertexai=True,
            project=VERTEX_AI_PROJECT,
            location=VERTEX_AI_LOCATION
        )
        vertex_ai_available = True
        print(f"✓ Unified google-genai client initialized for Vertex AI project {VERTEX_AI_PROJECT} in {VERTEX_AI_LOCATION}")
    except Exception as e:
        print(f"⚠ Unified Vertex AI initialization failed: {e}")
        vertex_ai_available = False
else:
    print("Warning: Vertex AI project ID is not set in VERTEX_AI_PROJECT. Vertex AI is required and Google AI Studio fallbacks are disabled.")

image_generation_available = vertex_ai_available

from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Salon AI Hair Styling Recommendation API",
    description="AI-powered hair styling recommendations based on client photos and attributes using Gemini Flash 2.5",
    version="1.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the frontend directory
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")
    print(f"✓ Mounted frontend directory from {frontend_dir}")
else:
    print(f"⚠ Frontend directory not found at {frontend_dir}")

# Data models
class ClientAttributes(BaseModel):
    height: Optional[float] = None  # in cm
    gender: Optional[str] = None  # male, female, non-binary
    face_shape: Optional[str] = None  # oval, round, square, heart, diamond
    body_type: Optional[str] = None  # ectomorph, mesomorph, endomorph, etc.
    hair_type: Optional[str] = None  # straight, wavy, curly, coily
    hair_length: Optional[str] = None  # short, medium, long
    skin_tone: Optional[str] = None  # fair, light, medium, tan, deep
    ethnicity: Optional[str] = None  # South Asian, East Asian, Caucasian, Black, Hispanic, Middle Eastern, etc.
    preferred_style: Optional[str] = None  # casual, formal, trendy, classic
    lifestyle: Optional[str] = None  # active, professional, casual, glamorous
    maintenance_level: Optional[str] = None  # low, medium, high

class HairRecommendation(BaseModel):
    style_name: str
    description: str
    suitability_score: float  # 0-100
    reasoning: List[str]
    maintenance_tips: List[str]
    products_needed: List[str]
    visualization_url: Optional[str] = None  # URL to generated visualization
    video_url: Optional[str] = None  # URL to generated Veo video try-on

class RecommendationRequest(BaseModel):
    client_attributes: ClientAttributes
    # Image data will be sent separately as multipart/form-data

class RecommendationResponse(BaseModel):
    recommendations: List[HairRecommendation]
    analysis_details: Dict[str, Any]
    timestamp: str

def generate_vertex_ai_content(contents: list, response_mime_type: Optional[str] = None) -> Any:
    """Helper to try generating content with multiple model versions and regions under Vertex AI using google-genai"""
    model_names = [
        "gemini-2.5-flash",
        "gemini-3.5-flash",
        "gemini-2.0-flash-001",
        "gemini-2.5-pro",
        "gemini-3.1-flash-lite"
    ]
    
    regions = [VERTEX_AI_LOCATION, "us-east4", "us-west1", "europe-west1", "europe-west9"]
    regions = [r for r in regions if r]  # Filter out None/empty
    
    last_err = None
    for region in regions:
        try:
            print(f"DEBUG: Initializing Vertex AI client for region: {region}")
            client = genai.Client(
                vertexai=True,
                project=VERTEX_AI_PROJECT,
                location=region
            )
            
            for model_name in model_names:
                try:
                    print(f"DEBUG: Trying Vertex AI model: {model_name} in region: {region}")
                    config = None
                    if response_mime_type:
                        config = types.GenerateContentConfig(response_mime_type=response_mime_type)
                        
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=config
                    )
                    print(f"DEBUG: Successfully used Vertex AI model: {model_name} in region: {region}")
                    return response
                except Exception as e:
                    last_err = e
                    print(f"DEBUG: Model {model_name} in region {region} failed: {str(e)[:150]}...")
                    continue
        except Exception as init_err:
            print(f"DEBUG: Failed to initialize client for region {region}: {init_err}")
            continue
            
    raise last_err if last_err else Exception("All Vertex AI models and regions failed")


def analyze_image_and_generate_recommendations(image: Image.Image, client_height: Optional[float] = None) -> Dict[str, Any]:
    """
    Perform a single multimodal call to Gemini to analyze the image features
    AND generate the top 3 styling recommendations at the same time.
    """
    errors = []
    
    prompt = f"""
    You are a professional salon hairstylist, image consultant, and beauty expert.
    Analyze this client's photo and do two things:
    
    1. Analyze their physical features:
       - Gender (male, female, non-binary)
       - Face shape (oval, round, square, heart, diamond, oblong)
       - Hair type (straight, wavy, curly, coily)
       - Hair length (very short, short, medium, long, very long)
       - Skin tone (fair, light, medium, tan, deep)
       - Undertone (warm, cool, neutral)
       - Ethnicity (South Asian, East Asian, Caucasian, Black, Hispanic, Middle Eastern, etc.)
       - Confidence level for each detection (0.0-1.0)
       - Key observation notes about their hair and look
       
    2. Generate the top 3 best hairstyle recommendations that:
       - STRICTLY match the client's detected gender (e.g. recommend male hairstyles if they are male).
       - Are realistically achievable given their current hair length (e.g. do not recommend long or shoulder-length hairstyles if they currently have short or very short hair, unless you explain it requires extensions or is a long-term growth goal).
       - Complement their face shape, hair type/texture, skin tone, and detected ethnicity/locality trends beautifully.
       - Height: {client_height} cm (if provided, otherwise ignore).

    Respond in JSON format only with this exact structure:
    {{
        "analysis": {{
            "gender": "detected_gender",
            "gender_confidence": 0.0-1.0,
            "face_shape": "detected_shape",
            "face_confidence": 0.0-1.0,
            "hair_type": "detected_type",
            "hair_confidence": 0.0-1.0,
            "hair_length": "detected_length",
            "skin_tone": "detected_tone",
            "skin_confidence": 0.0-1.0,
            "undertone": "detected_undertone",
            "ethnicity": "detected_ethnicity",
            "ethnicity_confidence": 0.0-1.0,
            "notes": "brief explanation of key observations"
        }},
        "recommendations": [
            {{
                "style_name": "Hairstyle Name",
                "description": "Vivid description of the cut, volume, and how it is styled.",
                "suitability_score": 0.0-100.0,
                "reasoning": [
                    "Reason 1 matching face shape",
                    "Reason 2 matching hair type or length",
                    "Reason 3 matching ethnicity or locality styling trend"
                ],
                "maintenance_tips": [
                    "Tip 1",
                    "Tip 2"
                ],
                "products_needed": [
                    "Product 1",
                    "Product 2"
                ]
            }},
            ...
        ]
    }}
    """

    # 1. Try Vertex AI
    if vertex_ai_available:
        try:
            print("DEBUG: Sending combined analysis and recommendation prompt to Vertex AI")
            response = generate_vertex_ai_content(
                [prompt, image],
                response_mime_type="application/json"
            )

            print(f"DEBUG: Raw response text: {response.text}")
            import json
            result = json.loads(response.text)
            validate_combined_response(result)
            return result
        except Exception as e:
            err_msg = f"Vertex AI combined analysis failed: {e}"
            print(f"DEBUG: {err_msg}")
            errors.append(err_msg)

    # Rely exclusively on Vertex AI as requested by the user
    raise Exception(f"Combined analysis and recommendation failed. Errors: {'; '.join(errors)}")


def validate_combined_response(result: Dict[str, Any]):
    """Validate that the combined response has all required analysis and recommendation fields"""
    if "analysis" not in result or "recommendations" not in result:
        raise ValueError("Response missing 'analysis' or 'recommendations' keys")
        
    analysis = result["analysis"]
    required_analysis_fields = ["gender", "face_shape", "hair_type", "hair_length", "skin_tone", "undertone", "ethnicity"]
    for field in required_analysis_fields:
        if field not in analysis:
            raise ValueError(f"Missing required analysis field '{field}'")
            
    recs = result["recommendations"]
    if not isinstance(recs, list) or len(recs) == 0:
        raise ValueError("Recommendations must be a non-empty list")
        
    for idx, rec in enumerate(recs):
        required_rec_fields = ["style_name", "description", "suitability_score", "reasoning", "maintenance_tips", "products_needed"]
        for field in required_rec_fields:
            if field not in rec:
                raise ValueError(f"Recommendation at index {idx} missing required field '{field}'")


def generate_hairstyle_editing(original_image: Image.Image,
                              hairstyle_name: str,
                              hairstyle_description: str,
                              client_attrs: ClientAttributes) -> Optional[str]:
    """Edit the client's hair in the original image using mask-free editing via edit_image"""
    if not vertex_client:
        raise Exception("Vertex AI client is not configured or initialized")
        
    try:
        # Convert PIL image to bytes
        img_byte_arr = io.BytesIO()
        original_image.save(img_byte_arr, format='JPEG')
        img_bytes = img_byte_arr.getvalue()
        
        # Prepare reference image
        input_image = types.Image(image_bytes=img_bytes)
        raw_ref_image = types.RawReferenceImage(
            reference_id=1,
            reference_image=input_image
        )
        
        prompt = f"""
        A professional studio portrait of the same person from the reference image, but change their hairstyle to: {hairstyle_name}.
        {hairstyle_description}
        Keep their face, expression, clothing, and background identical to the reference image.
        """
        print(f"DEBUG: Sending edit_image request for hairstyle: {hairstyle_name}")
        
        response = vertex_client.models.edit_image(
            model="imagen-3.0-capability-001",
            prompt=prompt,
            reference_images=[raw_ref_image],
            config=types.EditImageConfig(
                edit_mode="EDIT_MODE_DEFAULT",
                number_of_images=1,
                aspect_ratio="1:1"
            )
        )
        
        if response.generated_images:
            print(f"DEBUG: Successfully edited hairstyle using Imagen editing model")
            img_obj = response.generated_images[0]
            if hasattr(img_obj, "image") and hasattr(img_obj.image, "image_bytes"):
                image_base64 = base64.b64encode(img_obj.image.image_bytes).decode('utf-8')
                return f"data:image/png;base64,{image_base64}"
                
        print("DEBUG: Image editing returned no images.")
        return None
    except Exception as e:
        print(f"DEBUG: Hairstyle editing failed: {e}. Falling back to standard image generation.")
        return None


def generate_hairstyle_visualization(original_image: Image.Image,
                                   hairstyle_name: str,
                                   hairstyle_description: str,
                                   client_attrs: ClientAttributes) -> str:
    """Generate visualization of hairstyle on client using Vertex AI Imagen"""
    if not vertex_ai_available:
        raise Exception("Vertex AI is not initialized/available for image generation")
        
    # Try editing the hairstyle on the original photo first
    result = generate_hairstyle_editing(
        original_image,
        hairstyle_name,
        hairstyle_description,
        client_attrs
    )
    
    # Fallback to text-to-image generation if editing failed
    if not result:
        print("DEBUG: Falling back to text-to-image generation for hairstyle visualization")
        result = generate_with_vertex_ai_imagen(
            original_image,
            hairstyle_name,
            hairstyle_description,
            client_attrs
        )
        
    if not result:
        raise Exception("Vertex AI Imagen returned empty/no image data")
    return result


def generate_with_vertex_ai_imagen(original_image: Image.Image,
                                 hairstyle_name: str,
                                 hairstyle_description: str,
                                 client_attrs: ClientAttributes) -> str:
    """Generate image using Vertex AI Imagen model via google-genai"""
    if not vertex_client:
        raise Exception("Vertex AI client is not configured or initialized")

    gender_str = client_attrs.gender if client_attrs.gender else "person"
    length_str = f"with {client_attrs.hair_length} hair length" if client_attrs.hair_length else ""
    
    prompt = f"""
    A professional studio portrait of a {gender_str} {length_str} with {client_attrs.face_shape} face shape, {client_attrs.hair_type} hair,
    {client_attrs.skin_tone} skin tone, wearing a {hairstyle_name} hairstyle.
    {hairstyle_description}
    Professional salon style photography, studio lighting, neutral background, high quality, highly detailed, realistic hair texture.
    """
    print(f"DEBUG: Generated prompt for Vertex AI Imagen: {prompt}")

    # List of possible Imagen model names to try (in order of preference)
    model_names = [
        "imagen-3.0-generate-002",
        "imagen-3.0-generate-001",
        "imagen-3.0-fast-generate-001",
        "imagen-4.0-generate-001"
    ]

    last_error = None
    for model_name in model_names:
        try:
            print(f"DEBUG: Trying Vertex AI Imagen model: {model_name}")
            result = vertex_client.models.generate_images(
                model=model_name,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="1:1"
                )
            )
            
            if result.generated_images:
                print(f"DEBUG: Successfully used Imagen model: {model_name}")
                img_obj = result.generated_images[0]
                if hasattr(img_obj, "image") and hasattr(img_obj.image, "image_bytes"):
                    image_base64 = base64.b64encode(img_obj.image.image_bytes).decode('utf-8')
                    return f"data:image/png;base64,{image_base64}"
            
            raise Exception("Imagen returned empty/no generated images")
        except Exception as e:
            last_error = e
            print(f"DEBUG: Imagen model {model_name} failed: {str(e)[:150]}...")
            continue

    # If all models failed, raise the last error
    raise last_error if last_error else Exception("All Vertex AI Imagen model attempts failed")


def generate_veo_video(hairstyle_name: str,
                       hairstyle_description: str,
                       client_attrs: ClientAttributes) -> Optional[str]:
    """Generate an 8-second video of the client on a runway with the new hairstyle using Veo"""
    if not vertex_client:
        print("DEBUG: Vertex AI client not configured. Skipping video generation.")
        return None
        
    gender_str = client_attrs.gender if client_attrs.gender else "model"
    ethnicity_str = f"of {client_attrs.ethnicity} ethnicity" if client_attrs.ethnicity else ""
    skin_tone_str = f"with {client_attrs.skin_tone} skin tone" if client_attrs.skin_tone else ""
    
    prompt = f"""
    A professional fashion model (matching gender: {gender_str}, {ethnicity_str}, {skin_tone_str})
    wearing a {hairstyle_name} hairstyle ({hairstyle_description}) walking on a runway ramp.
    Professional studio lighting, fashion show runway backdrop, detailed hair texture and motion, realistic walk.
    """
    print(f"DEBUG: Generated prompt for Veo Video: {prompt}")
    
    # We will try available Veo models in order of preference
    model_names = [
        "veo-2.0-generate-001",
        "veo-3.0-fast-generate-001",
        "veo-3.0-generate-001",
        "veo-3.1-lite-generate-001"
    ]
    
    last_err = None
    for model_name in model_names:
        try:
            print(f"DEBUG: Initiating video generation with Veo model: {model_name}")
            operation = vertex_client.models.generate_videos(
                model=model_name,
                prompt=prompt,
                config=types.GenerateVideosConfig(
                    number_of_videos=1,
                    duration_seconds=8,
                    aspect_ratio="16:9"
                )
            )
            
            # Poll for completion (video generation can take time)
            print("DEBUG: Waiting for video generation operation to complete...")
            timeout = 300  # 5 minutes maximum timeout
            start_time = time.time()
            while not operation.done:
                if time.time() - start_time > timeout:
                    raise TimeoutError("Video generation timed out.")
                time.sleep(10)
                operation = vertex_client.operations.get(operation)
                
            if operation.result and operation.result.generated_videos:
                print(f"DEBUG: Veo Video generation complete for model: {model_name}")
                video_obj = operation.result.generated_videos[0]
                if hasattr(video_obj, "video") and hasattr(video_obj.video, "video_bytes") and video_obj.video.video_bytes:
                    video_base64 = base64.b64encode(video_obj.video.video_bytes).decode('utf-8')
                    return f"data:video/mp4;base64,{video_base64}"
            
            raise Exception("Veo returned empty/no video data")
        except Exception as e:
            last_err = e
            print(f"DEBUG: Veo model {model_name} failed: {str(e)[:150]}...")
            continue
            
    print(f"DEBUG: Veo video generation failed for all models: {last_err}")
    return None

@app.post("/analyze", response_model=RecommendationResponse)
async def analyze_and_recommend(
    file: UploadFile = File(...),
    height: Optional[str] = Form(None)
):
    """
    Analyze client photo and provide hair styling recommendations.
    All attributes and recommendations are generated in a single multimodal AI call.
    """
    try:
        # Read and process image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))

        # Convert to RGB if necessary
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Parse height from user input
        client_height = None
        if height:
            try:
                client_height = float(height)
                if client_height < 50 or client_height > 250:
                    raise ValueError("Height must be between 50 and 250 cm")
            except ValueError as ve:
                if "could not convert" in str(ve):
                    raise HTTPException(status_code=400, detail="Invalid height value")
                else:
                    raise HTTPException(status_code=400, detail=str(ve))

        # Run AI combined analysis and recommendation
        result = analyze_image_and_generate_recommendations(image, client_height)

        analysis = result["analysis"]
        detected_gender = analysis["gender"]
        detected_face_shape = analysis["face_shape"]
        detected_hair_type = analysis["hair_type"]
        detected_hair_length = analysis["hair_length"]
        detected_skin_tone = analysis["skin_tone"]
        detected_undertone = analysis["undertone"]
        detected_ethnicity = analysis["ethnicity"]

        # Get confidence scores
        gender_confidence = analysis.get("gender_confidence", 0.8)
        face_confidence = analysis.get("face_confidence", 0.8)
        hair_confidence = analysis.get("hair_confidence", 0.8)
        skin_confidence = analysis.get("skin_confidence", 0.8)
        ethnicity_confidence = analysis.get("ethnicity_confidence", 0.8)

        # Create client attributes object for output matching schema
        client_attrs = ClientAttributes(
            height=client_height,
            gender=detected_gender,
            face_shape=detected_face_shape,
            body_type="mesomorph",
            hair_type=detected_hair_type,
            hair_length=detected_hair_length,
            skin_tone=detected_skin_tone,
            ethnicity=detected_ethnicity,
            preferred_style=None,
            lifestyle=None,
            maintenance_level=None
        )

        # Process recommendations and generate visualizations
        recommendations = []
        for idx, item in enumerate(result["recommendations"][:3]):
            rec = HairRecommendation(
                style_name=item["style_name"],
                description=item["description"],
                suitability_score=float(item.get("suitability_score", 90.0)),
                reasoning=item.get("reasoning", []),
                maintenance_tips=item.get("maintenance_tips", []),
                products_needed=item.get("products_needed", []),
                visualization_url=None,
                video_url=None
            )

            # Generate Imagen visualization
            if image_generation_available:
                try:
                    visualization_data = generate_hairstyle_visualization(
                        image,
                        rec.style_name,
                        rec.description,
                        client_attrs
                    )
                    rec.visualization_url = visualization_data
                except Exception as vis_err:
                    print(f"DEBUG: Failed to generate visualization for {rec.style_name}: {vis_err}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Hairstyle visualization generation failed: {vis_err}"
                    )

            # Generate Veo video ONLY for the highest-scoring recommendation (first index)
            if idx == 0 and image_generation_available:
                try:
                    print(f"DEBUG: Triggering Veo video generation for top style: {rec.style_name}")
                    video_data = generate_veo_video(
                        rec.style_name,
                        rec.description,
                        client_attrs
                    )
                    rec.video_url = video_data
                except Exception as vid_err:
                    # Log but do not fail the request if video generation has issues
                    print(f"DEBUG: Failed to generate Veo video for {rec.style_name}: {vid_err}")

            recommendations.append(rec)

        # Prepare analysis details matching existing format
        analysis_engine_name = "Vertex AI Gemini"
        analysis_details = {
            "gender_analysis": {
                "detected_gender": detected_gender,
                "confidence": gender_confidence,
                "notes": analysis.get("notes", f"Analysis via {analysis_engine_name}")
            },
            "face_analysis": {
                "detected_shape": detected_face_shape,
                "confidence": face_confidence,
                "notes": analysis.get("notes", f"Analysis via {analysis_engine_name}")
            },
            "hair_analysis": {
                "detected_type": detected_hair_type,
                "detected_length": detected_hair_length,
                "confidence": hair_confidence,
                "notes": analysis.get("notes", f"Analysis via {analysis_engine_name}")
            },
            "skin_analysis": {
                "detected_tone": detected_skin_tone,
                "detected_undertone": detected_undertone,
                "confidence": skin_confidence,
                "notes": analysis.get("notes", f"Analysis via {analysis_engine_name}")
            },
            "ethnicity_analysis": {
                "detected_ethnicity": detected_ethnicity,
                "confidence": ethnicity_confidence,
                "notes": analysis.get("notes", f"Analysis via {analysis_engine_name}")
            },
            "client_attributes": client_attrs.model_dump()
        }

        return RecommendationResponse(
            recommendations=recommendations,
            analysis_details=analysis_details,
            timestamp=datetime.utcnow().isoformat()
        )

    except ValueError as ve:
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(ve)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    vertex_status = "configured" if vertex_ai_available else "not_configured"
    active_engine = "Vertex AI Gemini" if vertex_ai_available else "not_configured"
    return {
        "status": "healthy",
        "service": "salons-ai-recommendation",
        "analysis_engine": active_engine,
        "vertex_ai": vertex_status,
        "model": "gemini-2.5-flash" if vertex_ai_available else "none"
    }

@app.get("/")
async def root():
    """Root endpoint"""
    active_engine = "Vertex AI Gemini" if vertex_ai_available else "None"
    return {
        "message": f"Salon AI Hair Styling Recommendation API with {active_engine}",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)