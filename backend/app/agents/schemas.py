import pydantic
from typing import List, Annotated
from pydantic import BeforeValidator

# Coercion functions to handle LLM formatting inconsistencies resiliently
def coerce_list(v):
    if isinstance(v, list):
        # Handle case where model outputs a list containing a single multiline/comma-separated string
        if len(v) == 1 and isinstance(v[0], str) and ("\n" in v[0] or "," in v[0]):
            v = v[0]
        else:
            return [str(item).strip().lstrip("-*• ").strip() for item in v if item]
            
    if isinstance(v, str):
        if "\n" in v:
            return [line.strip().lstrip("-*• ").strip() for line in v.split("\n") if line.strip()]
        return [item.strip() for item in v.split(",") if item.strip()]
    return v

def coerce_float(v):
    if isinstance(v, str):
        v = v.replace("%", "").strip()
        try:
            return float(v)
        except ValueError:
            return 0.0
    return v

CoercedList = Annotated[List[str], BeforeValidator(coerce_list)]
CoercedFloat = Annotated[float, BeforeValidator(coerce_float)]


class ClientProfileAnalysis(pydantic.BaseModel):
    gender: str = pydantic.Field(
        description="The detected gender of the client, e.g., male, female, non-binary."
    )
    gender_confidence: CoercedFloat = pydantic.Field(
        description="Confidence score for gender detection, from 0.0 to 1.0."
    )
    face_shape: str = pydantic.Field(
        description="The detected face shape, e.g., oval, round, square, heart, diamond, oblong."
    )
    face_confidence: CoercedFloat = pydantic.Field(
        description="Confidence score for face shape detection, from 0.0 to 1.0."
    )
    hair_type: str = pydantic.Field(
        description="The detected hair type, e.g., straight, wavy, curly, coily."
    )
    hair_confidence: CoercedFloat = pydantic.Field(
        description="Confidence score for hair type detection, from 0.0 to 1.0."
    )
    hair_length: str = pydantic.Field(
        description="The detected hair length, e.g., short, medium, long."
    )
    skin_tone: str = pydantic.Field(
        description="The detected skin tone, e.g., fair, light, medium, tan, deep."
    )
    skin_confidence: CoercedFloat = pydantic.Field(
        description="Confidence score for skin tone detection, from 0.0 to 1.0."
    )
    undertone: str = pydantic.Field(
        description="The detected skin undertone, e.g., warm, cool, neutral."
    )
    ethnicity: str = pydantic.Field(
        description="The detected ethnicity, e.g., South Asian, East Asian, Caucasian, Black, Hispanic, Middle Eastern, etc."
    )
    ethnicity_confidence: CoercedFloat = pydantic.Field(
        description="Confidence score for ethnicity detection, from 0.0 to 1.0."
    )
    notes: str = pydantic.Field(
        description="Brief analysis notes explaining physical styling cues, hair density, texture, and observations."
    )


class HairRecommendationModel(pydantic.BaseModel):
    style_name: str = pydantic.Field(
        description="Name of the hairstyle recommended."
    )
    description: str = pydantic.Field(
        description="Vivid description of the cut, volume, and how it is styled."
    )
    suitability_score: CoercedFloat = pydantic.Field(
        description="A suitability match percentage from 0.0 to 100.0."
    )
    reasoning: CoercedList = pydantic.Field(
        description="List of 3 specific reasons why this style fits the client's face shape, hair type, and ethnicity trends."
    )
    maintenance_tips: CoercedList = pydantic.Field(
        description="List of exactly 2 key maintenance or hair-care tips."
    )
    products_needed: CoercedList = pydantic.Field(
        description="List of exactly 3 recommended styling products."
    )


class RecommendationListModel(pydantic.BaseModel):
    recommendations: List[HairRecommendationModel] = pydantic.Field(
        description="List of exactly 3 hairstyle recommendations matching the client's profile."
    )
