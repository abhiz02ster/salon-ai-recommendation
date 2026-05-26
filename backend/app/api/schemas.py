from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ClientAttributes(BaseModel):
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
    products_status: Optional[List[Dict[str, Any]]] = None
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

class CheckInRequest(BaseModel):
    first_name: str
    last_name: str
    phone: str

class CheckInResponse(BaseModel):
    client_id: int
    first_name: str
    last_name: str
    phone: str
    history: List[Dict[str, Any]]

class ConfirmStyleRequest(BaseModel):
    client_id: int
    consultation_id: int
    style_name: str

class ConfirmStyleResponse(BaseModel):
    success: bool
    confirmed_id: int

class ClientResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    total_visits: int
    total_spent: float
    last_visit_date: Optional[str] = None
    is_active: int

class ClientListResponse(BaseModel):
    clients: List[ClientResponse]

class ColorFormula(BaseModel):
    date: str
    formula: str
    stylist_name: str

class StyleHistoryItem(BaseModel):
    date: str
    recommended_style: Optional[str] = None
    actual_service: Optional[str] = None
    satisfaction_score: Optional[int] = None
    notes: Optional[str] = None

class ClientProfileResponse(BaseModel):
    client_id: int
    first_name: str
    last_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    allergies: Optional[str] = None
    hair_density: Optional[str] = None
    hair_porosity: Optional[str] = None
    hair_elasticity: Optional[str] = None
    natural_color: Optional[str] = None
    scalp_type: Optional[str] = None
    chemical_treatment_history: Optional[str] = None
    typical_maintenance: Optional[str] = None
    color_formulas: List[ColorFormula]
    style_history: List[StyleHistoryItem]

class ClientProfileUpdateRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    allergies: Optional[str] = None
    hair_density: Optional[str] = None
    hair_porosity: Optional[str] = None
    hair_elasticity: Optional[str] = None
    natural_color: Optional[str] = None
    scalp_type: Optional[str] = None
    chemical_treatment_history: Optional[str] = None
    typical_maintenance: Optional[str] = None

class AppointmentCreateRequest(BaseModel):
    client_id: int
    appointment_date: str
    consultation_id: int
    total_amount: float

class AppointmentCreateResponse(BaseModel):
    appointment_id: int
    loyalty_points_earned: int
    status: str

class ProductInventoryResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    cost_price: float
    selling_price: Optional[float] = None
    stock: float
    is_active: int
    salon_category: Optional[str] = None
    brand: Optional[str] = None
    size_volume: Optional[str] = None
    is_professional_use: int
    minimum_stock_level: float
    reorder_quantity: float
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    inventory_type: str  # 'product' or 'material'
    quantity_in_stock: float
    safety_stock_level: float
    status: str  # 'critical' or 'normal'

class InventoryListResponse(BaseModel):
    products: List[ProductInventoryResponse]

class InventoryTransactionRequest(BaseModel):
    product_id: int  # serves as item_id
    inventory_type: str  # 'product' or 'material'
    transaction_type: str  # 'receive', 'sale', 'usage', 'adjustment'
    quantity: float
    performed_by: str
    reference_id: Optional[int] = None

class InventoryTransactionResponse(BaseModel):
    success: bool
    new_quantity: float
    alert_triggered: bool

class SupplierResponse(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    payment_terms: Optional[str] = None
    is_active: int

class SupplierListResponse(BaseModel):
    suppliers: List[SupplierResponse]

class StockAlertResponse(BaseModel):
    item_id: int
    sku: str
    name: str
    inventory_type: str
    quantity_in_stock: float
    safety_stock_level: float
    supplier_name: str
    reorder_quantity: float

class StockAlertListResponse(BaseModel):
    alerts: List[StockAlertResponse]
