from fastapi import APIRouter, File, UploadFile, HTTPException, Form, Query, Body
from typing import Optional, List
from datetime import datetime
import app.database as database
import app.services.consultation as consultation
from app.services.media import vertex_ai_available
import app.services.whatsapp as whatsapp
from app.api.schemas import (
    RecommendationResponse, RefineRequest, CheckInRequest, CheckInResponse, 
    ConfirmStyleRequest, ConfirmStyleResponse, ClientListResponse, 
    ClientProfileResponse, ClientProfileUpdateRequest, AppointmentCreateRequest, 
    AppointmentCreateResponse, InventoryListResponse, InventoryTransactionRequest, 
    InventoryTransactionResponse, StockAlertListResponse, SupplierListResponse,
    FeedbackRequest, CampaignRequest
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

@router.get("/api/crm/clients/search-by-phone")
async def search_client_by_phone(phone: str):
    """
    Search for existing clients by phone number.
    Returns a list of matching client profiles and history.
    """
    try:
        clients = database.get_clients_by_phone(phone)
        if not clients:
            return {"found": False, "clients": []}
        
        results = []
        for client in clients:
            history = database.get_client_history(client["id"])
            results.append({
                "client_id": client["id"],
                "first_name": client["first_name"],
                "last_name": client["last_name"],
                "phone": client["phone"],
                "history": history
            })
        return {
            "found": True,
            "clients": results
        }
    except Exception as e:
        print(f"Error searching client: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
            request.client_id, request.appointment_date, request.consultation_id, request.total_amount, request.payment_method, request.staff_id
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

@router.post("/api/crm/appointments/{appointment_id}/feedback")
async def update_appointment_feedback(appointment_id: int, request: FeedbackRequest):
    """Update satisfaction score and notes for a client's styling history associated with an appointment, and send invoice bill to WhatsApp"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        
        # Check if record exists in client_style_history
        cursor.execute("SELECT id FROM client_style_history WHERE appointment_id = ?", (appointment_id,))
        row = cursor.fetchone()
        
        success = False
        if row:
            cursor.execute("""
            UPDATE client_style_history
            SET satisfaction_score = ?, notes = ?
            WHERE appointment_id = ?
            """, (request.satisfaction_score, request.notes, appointment_id))
            conn.commit()
            success = True
            
        conn.close()
        
        # Generate and dispatch receipt invoice via WhatsApp if appointment was processed successfully
        if success:
            billing = database.get_appointment_billing_details(appointment_id)
            if billing:
                stylist_name = f"{billing['stylist_first']} {billing['stylist_last']}" if billing['stylist_first'] else "Any Available Stylist"
                receipt_num = billing['receipt_number'] or f"REC-TEMP-{appointment_id}"
                pay_method = (billing['payment_method'] or "card").upper()
                
                # Format appointment date nicely if possible
                appt_dt = billing['appointment_datetime']
                try:
                    dt = datetime.strptime(appt_dt, "%Y-%m-%d %H:%M:%S")
                    dt_formatted = dt.strftime("%b %d, %Y at %I:%M %p")
                except Exception:
                    dt_formatted = appt_dt

                bill_body = (
                    "==================================\n"
                    "      MASTER STYLIST SALON      \n"
                    "==================================\n"
                    "INVOICE / RECEIPT\n"
                    "----------------------------------\n"
                    f"Receipt No: {receipt_num}\n"
                    f"Date: {dt_formatted}\n"
                    f"Client: {billing['first_name']} {billing['last_name']}\n"
                    f"Stylist: {stylist_name}\n"
                    "----------------------------------\n"
                    "Service Rendered:\n"
                    f"- {billing['service_name']} ({billing['duration_minutes']} mins)\n\n"
                    f"Total Amount: INR {billing['total_price']:.2f}\n"
                    f"Payment Method: {pay_method}\n"
                    "----------------------------------\n"
                    "Status: PAID & COMPLETED\n"
                    "Thank you for visiting!\n"
                    "Your feedback has been recorded.\n"
                    "See you next time! ✂️✨\n"
                    "=================================="
                )
                
                # Send WhatsApp notification using Twilio Sandbox
                whatsapp.send_twilio_whatsapp(billing['phone'], bill_body)
                
        return {"success": success}
    except Exception as e:
        print(f"Feedback submission error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# WHATSAPP INTEGRATION WEBHOOK & CAMPAIGN ENDPOINTS
# ============================================================================

@router.get("/api/whatsapp/webhook")
async def verify_meta_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge")
):
    """
    Verification endpoint for Meta WhatsApp Business webhook subscription
    """
    if hub_mode == "subscribe" and hub_verify_token == whatsapp.META_VERIFY_TOKEN:
        from fastapi.responses import PlainTextResponse
        print(f"✓ Meta Webhook verified. challenge: {hub_challenge}")
        return PlainTextResponse(content=hub_challenge)
    print("⚠ Meta Webhook verification failed due to token or mode mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")

@router.post("/api/whatsapp/webhook")
async def handle_meta_webhook(payload: dict = Body(...)):
    """
    Webhook handler for Meta WhatsApp incoming messages. Processes and passes to Chatbot State Machine.
    """
    try:
        # Check if this is a WhatsApp API notification payload
        if payload.get("object") != "whatsapp_business_account":
            return {"status": "ignored_object"}
            
        entries = payload.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])
                
                # Check for inbound client messages
                if messages:
                    msg = messages[0]
                    from_number = msg.get("from")
                    msg_type = msg.get("type")
                    
                    message_text = ""
                    if msg_type == "text":
                        message_text = msg.get("text", {}).get("body", "")
                    elif msg_type == "interactive":
                        # Support basic interactive button/list selection parsing
                        interactive = msg.get("interactive", {})
                        if interactive.get("type") == "button_reply":
                            message_text = interactive.get("button_reply", {}).get("title", "")
                        elif interactive.get("type") == "list_reply":
                            message_text = interactive.get("list_reply", {}).get("title", "")
                            
                    # Find sender's contact name if present in metadata
                    client_name = None
                    if contacts:
                        client_name = contacts[0].get("profile", {}).get("name")
                        
                    if from_number and message_text:
                        print(f"✓ Received message from {from_number}: {message_text}")
                        response = whatsapp.handle_chatbot_message(from_number, message_text, client_name)
                        return {"status": "success", "response": response}
                        
        return {"status": "no_messages"}
    except Exception as e:
        print(f"Error handling Meta Webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/twilio/webhook")
async def handle_twilio_webhook(
    From: str = Form(...),
    Body: str = Form(...),
    ProfileName: Optional[str] = Form(None)
):
    """
    Webhook handler for Twilio WhatsApp incoming messages.
    """
    try:
        print(f"✓ Received Twilio message from {From}: {Body}")
        response = whatsapp.handle_chatbot_message(From, Body, ProfileName)
        # Return empty TwiML response as our backend urllib client already dispatches replies
        from fastapi.responses import Response
        twiml = "<Response></Response>"
        return Response(content=twiml, media_type="application/xml")
    except Exception as e:
        print(f"Error handling Twilio Webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/crm/clients/{client_id}/check-in")
async def client_visit_check_in(client_id: int):
    """
    Triggered when a client checks in at the salon.
    Completes any scheduled appointments within a 2-hour window.
    """
    try:
        from datetime import timedelta
        conn = database.get_db()
        cursor = conn.cursor()
        
        # Select scheduled appointments for this client
        cursor.execute("""
            SELECT id, appointment_datetime 
            FROM appointments 
            WHERE client_id = ? AND status = 'scheduled'
        """, (client_id,))
        rows = cursor.fetchall()
        
        now = datetime.now()
        updated_ids = []
        
        for row in rows:
            appt_id = row['id']
            dt_str = row['appointment_datetime']
            try:
                # Try parsing formats
                if len(dt_str) == 16:
                    appt_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
                else:
                    appt_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
                
                # Check if difference is less than or equal to 2 hours
                if abs((now - appt_dt).total_seconds()) <= 7200:
                    cursor.execute("""
                        UPDATE appointments 
                        SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    """, (appt_id,))
                    updated_ids.append(appt_id)
            except Exception as ex:
                print(f"Error parsing date during check-in: {ex}")
                
        conn.commit()
        conn.close()
        return {"success": True, "auto_completed_appointments": updated_ids}
    except Exception as e:
        print(f"Error in client check-in status sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/crm/appointments/upcoming")
async def get_upcoming_appointments():
    """
    Retrieves all active scheduled appointments.
    First cleans up missed appointments (scheduled, but past by >2 hours) as 'no_show'.
    """
    try:
        from datetime import timedelta
        conn = database.get_db()
        cursor = conn.cursor()
        
        # 1. Clean up missed scheduled appointments
        cursor.execute("SELECT id, appointment_datetime FROM appointments WHERE status = 'scheduled'")
        rows = cursor.fetchall()
        now = datetime.now()
        
        for row in rows:
            appt_id = row['id']
            dt_str = row['appointment_datetime']
            try:
                if len(dt_str) == 16:
                    appt_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
                else:
                    appt_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
                
                # If missed by more than 2 hours, mark as no_show
                if now - appt_dt > timedelta(hours=2):
                    cursor.execute("""
                        UPDATE appointments 
                        SET status = 'no_show', updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    """, (appt_id,))
            except Exception as ex:
                print(f"Error parsing date during cleanup: {ex}")
        conn.commit()
        
        # 2. Query remaining active scheduled appointments
        cursor.execute("""
            SELECT a.id, a.appointment_datetime, a.total_price,
                   c.id AS client_id, c.first_name, c.last_name, c.phone,
                   s.name AS service_name,
                   st.first_name AS stylist_first, st.last_name AS stylist_last
            FROM appointments a
            JOIN clients c ON a.client_id = c.id
            JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.status = 'scheduled'
            ORDER BY a.appointment_datetime ASC
        """)
        upcoming = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return upcoming
    except Exception as e:
        print(f"Error getting upcoming appointments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/crm/whatsapp/campaign")
async def broadcast_campaign(request: CampaignRequest):
    """
    Broadcasts custom promotional message via Twilio Sandbox to all registered clients
    """
    try:
        clients = database.get_clients()
        sent_count = 0
        failed_count = 0
        
        for client in clients:
            phone = client.get("phone")
            # Skip default walk-in and empty phone numbers
            if not phone or phone == "9999999999":
                continue
                
            # Personalize campaign using client information
            first_name = client.get("first_name", "")
            last_name = client.get("last_name", "")
            
            # Format body with template variables
            try:
                body = request.message_template.format(
                    first_name=first_name,
                    last_name=last_name,
                    phone=phone
                )
            except KeyError as ke:
                # Fallback if invalid template key used
                body = request.message_template
                
            success = whatsapp.send_twilio_whatsapp(phone, body)
            if success:
                sent_count += 1
            else:
                failed_count += 1
                
        return {
            "success": True,
            "total_clients": len(clients),
            "sent_successfully": sent_count,
            "failed": failed_count
        }
    except Exception as e:
        print(f"Error broadcasting campaign: {e}")
        raise HTTPException(status_code=500, detail=f"Campaign failed: {str(e)}")

@router.post("/api/crm/whatsapp/remind")
async def send_appointment_reminders():
    """
    Sends appointment reminders to all clients with bookings scheduled in the next 24 hours
    """
    try:
        from datetime import timedelta
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")
        tomorrow_str = tomorrow.strftime("%Y-%m-%d %H:%M:%S")
        
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.id AS appointment_id, a.appointment_datetime,
                   c.first_name AS client_first, c.last_name AS client_last, c.phone AS client_phone,
                   s.name AS service_name,
                   st.first_name AS staff_first, st.last_name AS staff_last
            FROM appointments a
            JOIN clients c ON a.client_id = c.id
            JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.status = 'scheduled' AND a.appointment_datetime BETWEEN ? AND ?
        """, (now_str, tomorrow_str))
        reminders = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
        sent_count = 0
        failed_count = 0
        
        for r in reminders:
            phone = r.get("client_phone")
            if not phone or phone == "9999999999":
                continue
                
            client_name = f"{r.get('client_first', '')} {r.get('client_last', '')}".strip()
            service_name = r.get("service_name", "Service")
            
            staff_first = r.get("staff_first")
            staff_last = r.get("staff_last")
            staff_name = f"{staff_first} {staff_last}".strip() if (staff_first or staff_last) else "Any Available Stylist"
            
            dt_str = r.get("appointment_datetime")
            try:
                dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
                time_formatted = dt.strftime("%I:%M %p tomorrow")
            except Exception:
                time_formatted = dt_str
                
            body = (
                f"Hi {client_name}, this is a reminder for your upcoming {service_name} "
                f"with {staff_name} at {time_formatted}. We look forward to seeing you!"
            )
            
            success = whatsapp.send_twilio_whatsapp(phone, body)
            if success:
                sent_count += 1
            else:
                failed_count += 1
                
        return {
            "success": True,
            "appointments_found": len(reminders),
            "reminders_sent": sent_count,
            "failed": failed_count
        }
    except Exception as e:
        print(f"Error sending reminders: {e}")
        raise HTTPException(status_code=500, detail=f"Reminders failed: {str(e)}")

# ============================================================================
# SUPER ADMIN LOCAL CONFIGURATION & PROMOTION ENDPOINTS
# ============================================================================

@router.get("/api/config")
async def get_salon_config():
    """Retrieve salon local configurations"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT config_key, config_value FROM salon_config")
        rows = cursor.fetchall()
        conn.close()
        
        config = {r["config_key"]: r["config_value"] for r in rows}
        if "salon_name" not in config:
            config["salon_name"] = "Master Stylist Salon"
        if "active_theme" not in config:
            config["active_theme"] = "theme-alabaster-gold"
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/config")
async def update_salon_config(payload: dict = Body(...)):
    """Save/update key-value configurations"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        for key, value in payload.items():
            cursor.execute("""
            INSERT INTO salon_config (config_key, config_value)
            VALUES (?, ?)
            ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value
            """, (key, str(value)))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/staff")
async def get_staff_list():
    """Retrieve staff members list"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, first_name, last_name, specialty, stylist_passcode, admin_passcode, is_active FROM staff")
        rows = cursor.fetchall()
        conn.close()
        return {"staff": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/staff")
async def add_new_staff(payload: dict = Body(...)):
    """Add a new stylist/staff member and generate random passcodes"""
    import random
    try:
        stylist_code = f"{random.randint(100000, 999999)}"
        admin_code = f"{random.randint(100000, 999999)}"
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO staff (first_name, last_name, specialty, stylist_passcode, admin_passcode, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
        """, (payload["first_name"], payload["last_name"], payload.get("specialty", ""), stylist_code, admin_code))
        conn.commit()
        staff_id = cursor.lastrowid
        conn.close()
        return {
            "success": True,
            "staff_id": staff_id,
            "stylist_passcode": stylist_code,
            "admin_passcode": admin_code
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/staff/metrics")
async def get_staff_workload_metrics(staff_id: Optional[int] = Query(None)):
    """Compute workload and revenue metrics for selected or all staff members"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        
        if staff_id:
            cursor.execute("""
            SELECT COUNT(a.id) AS total_appointments, COALESCE(SUM(a.total_price), 0.0) AS total_revenue, COUNT(DISTINCT a.client_id) AS total_clients
            FROM appointments a
            WHERE a.staff_id = ? AND a.status = 'completed'
            """, (staff_id,))
            row = cursor.fetchone()
            metrics = dict(row) if row else {"total_appointments": 0, "total_revenue": 0, "total_clients": 0}
            
            cursor.execute("""
            SELECT a.id, a.appointment_datetime, a.total_price, c.first_name, c.last_name, c.phone, s.name AS service_name
            FROM appointments a
            JOIN clients c ON a.client_id = c.id
            JOIN services s ON a.service_id = s.id
            WHERE a.staff_id = ? AND a.status = 'completed'
            ORDER BY a.appointment_datetime DESC
            """, (staff_id,))
            history = [dict(r) for r in cursor.fetchall()]
            metrics["appointments"] = history
        else:
            cursor.execute("""
            SELECT s.id AS staff_id, s.first_name, s.last_name, s.specialty, s.stylist_passcode, s.admin_passcode,
                   COUNT(a.id) AS total_appointments, COALESCE(SUM(a.total_price), 0.0) AS total_revenue
            FROM staff s
            LEFT JOIN appointments a ON s.id = a.staff_id AND a.status = 'completed'
            GROUP BY s.id
            """)
            metrics = [dict(r) for r in cursor.fetchall()]
            
        conn.close()
        return metrics
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/promotions/run")
async def run_promotional_campaign(request: CampaignRequest):
    """Filter targets and dispatch promotional WhatsApp campaign messages"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        
        query = "SELECT id, first_name, last_name, phone, gender, hair_type, skin_tone FROM clients WHERE is_active = 1"
        params = []
        
        if request.filter_type == "gender" and request.filter_value:
            query += " AND gender = ?"
            params.append(request.filter_value)
        elif request.filter_type == "hair_type" and request.filter_value:
            query += " AND hair_type = ?"
            params.append(request.filter_value)
        elif request.filter_type == "skin_tone" and request.filter_value:
            query += " AND skin_tone = ?"
            params.append(request.filter_value)
        elif request.filter_type == "selected" and request.client_ids:
            placeholders = ",".join("?" for _ in request.client_ids)
            query += f" AND id IN ({placeholders})"
            params.extend(request.client_ids)
            
        cursor.execute(query, params)
        clients = [dict(r) for r in cursor.fetchall()]
        
        # Get salon name from config
        cursor.execute("SELECT config_value FROM salon_config WHERE config_key = 'salon_name'")
        row = cursor.fetchone()
        salon_name = row[0] if row else "Master Stylist Salon"
        conn.close()
        
        sent_count = 0
        for client in clients:
            # Replace templates
            msg = request.message_content.replace("{name}", f"{client['first_name']} {client['last_name']}")
            msg = msg.replace("{salon_name}", salon_name)
            msg = msg.replace("{booking_url}", f"http://localhost:3000/?mode=stylist")
            
            # Send WhatsApp message via Twilio Sandbox
            success = whatsapp.send_twilio_whatsapp(client["phone"], msg)
            if success:
                sent_count += 1
                
        return {"success": True, "recipients_count": len(clients), "messages_sent": sent_count}
    except Exception as e:
        print(f"Error running campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/crm/clients/{client_id}/notes")
async def get_client_notes(client_id: int):
    """Retrieve all stylist notes for a client"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT n.id, n.note_type, n.content, n.created_at, st.first_name || ' ' || st.last_name AS stylist_name
        FROM stylist_notes n
        JOIN appointments a ON n.appointment_id = a.id
        LEFT JOIN staff st ON n.stylist_id = st.id
        WHERE a.client_id = ?
        ORDER BY n.created_at DESC
        """, (client_id,))
        rows = cursor.fetchall()
        conn.close()
        return {"notes": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/crm/clients/{client_id}/notes")
async def add_client_note(client_id: int, payload: dict = Body(...)):
    """Add a stylist note associated with a client appointment"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        
        # Get the latest completed or scheduled appointment for this client
        cursor.execute("SELECT id FROM appointments WHERE client_id = ? ORDER BY created_at DESC LIMIT 1", (client_id,))
        appt_row = cursor.fetchone()
        
        if appt_row:
            appointment_id = appt_row[0]
        else:
            # Create a mock/system appointment to associate the note with
            cursor.execute("SELECT id FROM services LIMIT 1")
            svc = cursor.fetchone()
            service_id = svc[0] if svc else 1
            
            cursor.execute("SELECT id FROM staff LIMIT 1")
            stf = cursor.fetchone()
            staff_id = stf[0] if stf else 1
            
            cursor.execute("""
            INSERT INTO appointments (client_id, staff_id, service_id, appointment_datetime, status, total_price)
            VALUES (?, ?, ?, datetime('now'), 'completed', 0.0)
            """, (client_id, staff_id, service_id))
            appointment_id = cursor.lastrowid
            
        # Get staff/stylist performing this (from logged-in stylist in frontend)
        staff_id = payload.get("staff_id")
        if not staff_id:
            cursor.execute("SELECT id FROM staff LIMIT 1")
            stf = cursor.fetchone()
            staff_id = stf[0] if stf else 1
            
        cursor.execute("""
        INSERT INTO stylist_notes (appointment_id, stylist_id, note_type, content)
        VALUES (?, ?, ?, ?)
        """, (appointment_id, staff_id, payload.get("note_type", "general"), payload["content"]))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/auth/login")
async def portal_login(payload: dict = Body(...)):
    """Authenticate portals (stylist, admin, super-admin)"""
    role = payload.get("role")
    passcode = payload.get("passcode")
    staff_id = payload.get("staff_id")
    
    if not role or not passcode:
        raise HTTPException(status_code=400, detail="Missing role or passcode")
        
    if role == 'super-admin':
        if passcode == 'owner123':
            return {"success": True, "role": "super-admin"}
        else:
            raise HTTPException(status_code=401, detail="Incorrect owner passcode")
            
    elif role == 'admin':
        # Check dev default passcode
        if passcode == 'admin123':
            return {"success": True, "role": "admin"}
            
        # Check staff's admin passcode
        if not staff_id:
            raise HTTPException(status_code=400, detail="Staff member selection required for admin login")
            
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, first_name, last_name, admin_passcode FROM staff WHERE id = ? AND is_active = 1", (int(staff_id),))
        row = cursor.fetchone()
        conn.close()
        
        if row and row["admin_passcode"] == passcode:
            return {"success": True, "role": "admin", "staff": {"id": row["id"], "name": f"{row['first_name']} {row['last_name']}"}}
        else:
            raise HTTPException(status_code=401, detail="Incorrect admin passcode for this staff member")
            
    elif role == 'stylist':
        if not staff_id:
            raise HTTPException(status_code=400, detail="Staff member selection required for stylist login")
            
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, first_name, last_name, stylist_passcode FROM staff WHERE id = ? AND is_active = 1", (int(staff_id),))
        row = cursor.fetchone()
        conn.close()
        
        if row and row["stylist_passcode"] == passcode:
            return {"success": True, "role": "stylist", "staff": {"id": row["id"], "name": f"{row['first_name']} {row['last_name']}"}}
        else:
            raise HTTPException(status_code=401, detail="Incorrect stylist passcode")
            
    else:
        raise HTTPException(status_code=400, detail="Invalid role specified")

@router.get("/api/services")
async def get_services_list():
    """Retrieve active services list"""
    try:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, category, description, duration_minutes, base_price FROM services WHERE is_active = 1")
        rows = cursor.fetchall()
        conn.close()
        return {"services": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
