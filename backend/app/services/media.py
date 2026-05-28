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

# A mapping of hairstyle keywords to high-quality Unsplash styling photos
MOCK_HAIRSTYLES = {
    "short": [
        "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=600&auto=format&fit=crop", # male short
        "https://images.unsplash.com/photo-1605497746444-ac9dbd50d9f8?q=80&w=600&auto=format&fit=crop", # male cropped
        "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=600&auto=format&fit=crop"  # female short pixie
    ],
    "bob": [
        "https://images.unsplash.com/photo-1595959183075-c1d09e77bbd9?q=80&w=600&auto=format&fit=crop", # blonde bob
        "https://images.unsplash.com/photo-1617391654484-279268307e59?q=80&w=600&auto=format&fit=crop", # classic dark bob
        "https://images.unsplash.com/photo-1614313913007-2b4ae8ce32d6?q=80&w=600&auto=format&fit=crop"  # stylized wavy bob
    ],
    "long": [
        "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=600&auto=format&fit=crop", # long brown waves
        "https://images.unsplash.com/photo-1601412436009-d964bd02edbc?q=80&w=600&auto=format&fit=crop", # long flowing hair
        "https://images.unsplash.com/photo-1595959183075-c1d09e77bbd9?q=80&w=600&auto=format&fit=crop"
    ],
    "quiff": [
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600&auto=format&fit=crop", # quiff men
        "https://images.unsplash.com/photo-1621605815971-fbc98d665033?q=80&w=600&auto=format&fit=crop", # classic slick back
        "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=600&auto=format&fit=crop"  # stylish textured pompadour
    ],
    "default": [
        "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1595959183075-c1d09e77bbd9?q=80&w=600&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=600&auto=format&fit=crop"
    ]
}

MOCK_VIDEOS = [
    "https://assets.mixkit.co/videos/preview/mixkit-woman-with-beautiful-hair-40176-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-fashion-model-showing-her-haircut-39934-large.mp4",
    "https://assets.mixkit.co/videos/preview/mixkit-hairdresser-brushing-hair-of-a-client-34351-large.mp4"
]

def get_mock_image(style_name: str) -> str:
    style = style_name.lower()
    category = "default"
    if any(k in style for k in ["fade", "buzz", "short", "crop", "pixie", "undercut"]):
        category = "short"
    elif any(k in style for k in ["bob", "fringe", "pageboy", "lob", "bangs"]):
        category = "bob"
    elif any(k in style for k in ["long", "wave", "curl", "flow", "layers", "braids"]):
        category = "long"
    elif any(k in style for k in ["quiff", "pompadour", "slick", "mohawk", "comb"]):
        category = "quiff"
        
    options = MOCK_HAIRSTYLES[category]
    idx = len(style_name) % len(options)
    return options[idx]

def get_mock_video(style_name: str) -> str:
    idx = len(style_name) % len(MOCK_VIDEOS)
    return MOCK_VIDEOS[idx]

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
    """Generate high-quality styling visualization using Vertex AI Imagen or fallback mock data"""
    if settings.MOCK_MEDIA or not vertex_ai_available:
        mock_img = get_mock_image(hairstyle_name)
        print(f"DEBUG: Mocking styling image for '{hairstyle_name}' -> {mock_img}")
        return mock_img
        
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
    """Generate an 8-second video of the client on a runway with the new hairstyle using Veo or fallback mock data"""
    if settings.MOCK_MEDIA or not vertex_client:
        mock_vid = get_mock_video(hairstyle_name)
        print(f"DEBUG: Mocking runway video for '{hairstyle_name}' -> {mock_vid}")
        return mock_vid
        
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
