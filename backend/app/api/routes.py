from fastapi import APIRouter, File, UploadFile, HTTPException, Form
from typing import Optional, List
from datetime import datetime
import app.database as database
import app.services.consultation as consultation
from app.services.media import vertex_ai_available
from app.api.schemas import (
    RecommendationResponse, RefineRequest, CheckInRequest, CheckInResponse, 
    ConfirmStyleRequest, ConfirmStyleResponse, ClientListResponse, 
    ClientProfileResponse, ClientProfileUpdateRequest, AppointmentCreateRequest, 
    AppointmentCreateResponse, InventoryListResponse, InventoryTransactionRequest, 
    InventoryTransactionResponse, StockAlertListResponse, SupplierListResponse
)

router = APIRouter()

@router.post("/check-in", response_model=CheckInResponse)
async def check_in_client(request: CheckInRequest):
    """
    Check in a customer using first name, last name, and phone.
    Returns the client_id and their past consultation history.
    """
    try:
        client_id = database.get_or_create_client(
            request.first_name, request.last_name, request.phone
        )
        history = database.get_client_history(client_id)
        return CheckInResponse(
            client_id=client_id,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            history=history
        )
    except Exception as e:
        print(f"Check-in error: {e}")
        raise HTTPException(status_code=500, detail=f"Check-in failed: {str(e)}")

@router.post("/confirm-style", response_model=ConfirmStyleResponse)
async def confirm_style_selection(request: ConfirmStyleRequest):
    """
    Confirm style selection from recommendation cards. Logs it in database.
    """
    try:
        confirmed_id = database.log_style_selection(
            request.client_id, request.consultation_id, request.style_name
        )
        return ConfirmStyleResponse(success=True, confirmed_id=confirmed_id)
    except Exception as e:
        print(f"Confirmation selection error: {e}")
        raise HTTPException(status_code=500, detail=f"Confirmation failed: {str(e)}")

@router.post("/analyze", response_model=RecommendationResponse)
async def analyze_and_recommend(
    file_front: UploadFile = File(...),
    file_left: Optional[UploadFile] = File(None),
    file_right: Optional[UploadFile] = File(None),
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
            front_bytes, left_bytes, right_bytes, client_id
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
async def get_history(client_id: Optional[int] = None):
    """Retrieve history of all consultations, optionally filtered by client_id"""
    try:
        if client_id:
            history = database.get_client_history(client_id)
        else:
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

# ============================================================================
# CRM & CLIENT ENDPOINTS
# ============================================================================

@router.get("/api/crm/clients", response_model=ClientListResponse)
async def get_all_clients_route():
    """Retrieve all clients in the system"""
    try:
        clients = database.get_clients()
        return ClientListResponse(clients=clients)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/crm/clients/{client_id}/profile", response_model=ClientProfileResponse)
async def get_client_profile_route(client_id: int):
    """Retrieve client full profile, hair metrics, allergies, and color formulas"""
    try:
        profile = database.get_client_profile(client_id)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Client profile not found for ID {client_id}")
        return ClientProfileResponse(**profile)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/api/crm/clients/{client_id}/profile")
async def update_client_profile_route(client_id: int, request: ClientProfileUpdateRequest):
    """Update client physical metrics and allergies"""
    try:
        success = database.update_client_profile(client_id, request.model_dump(exclude_unset=True))
        return {"success": success, "updated_at": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/crm/appointments", response_model=AppointmentCreateResponse)
async def book_appointment_route(request: AppointmentCreateRequest):
    """Log a completed appointment and update loyalty points"""
    try:
        result = database.create_appointment_and_update_loyalty(
            request.client_id, request.appointment_date, request.consultation_id, request.total_amount
        )
        return AppointmentCreateResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# INVENTORY ENDPOINTS
# ============================================================================

@router.get("/api/inventory", response_model=InventoryListResponse)
async def get_inventory_route(category: Optional[str] = None, low_stock: Optional[bool] = None):
    """Retrieve all products & materials with current stock levels"""
    try:
        products = database.get_all_products(category=category, low_stock=bool(low_stock))
        return InventoryListResponse(products=products)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/inventory/transaction", response_model=InventoryTransactionResponse)
async def create_inventory_transaction_route(request: InventoryTransactionRequest):
    """Log a stock transaction (receive, sale, usage, adjustment) and update stock levels"""
    try:
        result = database.add_stock_transaction(
            request.product_id, request.inventory_type, request.transaction_type, request.quantity, request.performed_by, request.reference_id
        )
        return InventoryTransactionResponse(**result)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/inventory/alerts", response_model=StockAlertListResponse)
async def get_inventory_alerts_route():
    """Retrieve all active low-stock alerts"""
    try:
        alerts = database.get_active_alerts()
        return StockAlertListResponse(alerts=alerts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/suppliers", response_model=SupplierListResponse)
async def get_suppliers_route():
    """Retrieve all suppliers"""
    try:
        suppliers = database.get_suppliers()
        return SupplierListResponse(suppliers=suppliers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
