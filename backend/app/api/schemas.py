from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ClientAttributes(BaseModel):
    height: Optional[float] = None
    gender: Optional[str] = None
    face_shape: Optional[str] = None
    body_type: Optional[str] = None
    hair_type: Optional[str] = None
    hair_length: Optional[str] = None
    skin_tone: Optional[str] = None
    ethnicity: Optional[str] = None
    preferred_style: Optional[str] = None
    lifestyle: Optional[str] = None
    maintenance_level: Optional[str] = None

class HairRecommendation(BaseModel):
    style_name: str
    description: str
    suitability_score: float
    reasoning: List[str]
    maintenance_tips: List[str]
    products_needed: List[str]
    visualization_url: Optional[str] = None
    video_url: Optional[str] = None

class RecommendationResponse(BaseModel):
    recommendations: List[HairRecommendation]
    analysis_details: Dict[str, Any]
    timestamp: str
    consultation_id: Optional[int] = None

class RefineRequest(BaseModel):
    consultation_id: int
    feedback: str
