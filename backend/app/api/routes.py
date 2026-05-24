from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from typing import Optional
from datetime import datetime
import app.database as database
import app.services.consultation as consultation
from app.services.media import vertex_ai_available
from app.api.schemas import RecommendationResponse, RefineRequest

router = APIRouter()

@router.post("/analyze", response_model=RecommendationResponse)
async def analyze_and_recommend(
    file_front: UploadFile = File(...),
    file_left: Optional[UploadFile] = File(None),
    file_right: Optional[UploadFile] = File(None),
    height: Optional[str] = Form(None),
    client_id: Optional[int] = Form(None)
):
    """
    Analyze client's multi-angle photos (Front, Left, Right) using ProfilerAgent
    and get recommendations via StylistAgent. Saves consultation to database.
    """
    try:
        front_bytes = await file_front.read()
        left_bytes = await file_left.read() if file_left else None
        right_bytes = await file_right.read() if file_right else None
        
        return await consultation.analyze_and_recommend(
            front_bytes, left_bytes, right_bytes, height, client_id
        )
    except Exception as e:
        print(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@router.post("/refine", response_model=RecommendationResponse)
async def refine_recommendations(request: RefineRequest):
    """
    Refine hairstyle suggestions based on hairdresser feedback, retaining
    original client attributes and photo context.
    """
    try:
        return await consultation.refine_recommendations(
            request.consultation_id, request.feedback
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        print(f"Refinement error: {e}")
        raise HTTPException(status_code=500, detail=f"Refinement failed: {str(e)}")

@router.get("/history")
async def get_history():
    """Retrieve history of all consultations"""
    try:
        history = database.get_all_consultations()
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    """Health check endpoint"""
    vertex_status = "configured" if vertex_ai_available else "not_configured"
    active_engine = "Vertex AI Gemini (Antigravity SDK)" if vertex_ai_available else "not_configured"
    return {
        "status": "healthy",
        "service": "salons-ai-recommendation",
        "analysis_engine": active_engine,
        "vertex_ai": vertex_status,
        "model": "gemini-2.5-flash" if vertex_ai_available else "none"
    }

@router.get("/")
async def root():
    """Root endpoint"""
    active_engine = "Vertex AI Gemini (Antigravity SDK)" if vertex_ai_available else "None"
    return {
        "message": f"Salon AI Hair Styling Recommendation API with {active_engine}",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health"
    }
