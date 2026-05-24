import base64
import time
import os
from PIL import Image
from google import genai
from google.genai import types
from app.config import settings

# Initialize Vertex AI client
vertex_client = None
vertex_ai_available = False

if settings.USE_VERTEX_AI and settings.VERTEX_AI_PROJECT:
    try:
        vertex_client = genai.Client(
            vertexai=True,
            project=settings.VERTEX_AI_PROJECT,
            location=settings.VERTEX_AI_LOCATION
        )
        vertex_ai_available = True
        print(f"✓ Unified google-genai client initialized for Vertex AI project {settings.VERTEX_AI_PROJECT} in {settings.VERTEX_AI_LOCATION}")
    except Exception as e:
        print(f"⚠ Unified Vertex AI initialization failed: {e}")
        vertex_ai_available = False
else:
    print("Warning: Vertex AI project ID is not set in VERTEX_AI_PROJECT. Vertex AI is required.")

def generate_hairstyle_visualization(original_image: Image.Image,
                                   hairstyle_name: str,
                                   hairstyle_description: str,
                                   client_attrs) -> str:
    """Generate high-quality styling visualization using Vertex AI Imagen"""
    if not vertex_ai_available:
        raise Exception("Vertex AI is not initialized/available for image generation")
        
    print("DEBUG: Generating styling visualization directly (text-to-image) for originality")
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
                                 client_attrs) -> str:
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

    raise last_error if last_error else Exception("All Vertex AI Imagen model attempts failed")

def generate_veo_video(hairstyle_name: str,
                       hairstyle_description: str,
                       client_attrs) -> str:
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
            
            # Poll for completion
            print("DEBUG: Waiting for video generation operation to complete...")
            timeout = 300  # 5 minutes maximum
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
