import os
import urllib.request
import urllib.parse
import json
import base64
from datetime import datetime
import app.database as database

# Retrieve credentials
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "whatsapp:+14155238886")

META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "SALON_POC_VERIFY_TOKEN")
META_ACCESS_TOKEN = os.getenv("META_ACCESS_TOKEN")
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID")

def send_twilio_whatsapp(to_number: str, body: str) -> bool:
    """
    Sends outbound WhatsApp message using Twilio's WhatsApp Sandbox API.
    To receive these messages, the recipient must have opted-in (sent "join <keyword>" to Twilio).
    """
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("⚠ Twilio credentials not configured in environment")
        return False
        
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    
    # Clean and format the destination number (Twilio requires E.164 + prefix)
    to_clean = to_number
    if to_clean.startswith("whatsapp:"):
        to_clean = to_clean[9:]
    to_clean = "".join(c for c in to_clean if c.isdigit() or c == "+")
    if not to_clean.startswith("+"):
        to_clean = f"+{to_clean}"
    to_formatted = f"whatsapp:{to_clean}"
        
    from_formatted = TWILIO_FROM_NUMBER
    if not from_formatted.startswith("whatsapp:"):
        from_formatted = f"whatsapp:{from_formatted}"
        
    data = urllib.parse.urlencode({
        "From": from_formatted,
        "To": to_formatted,
        "Body": body
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, method="POST")
    
    # Auth header (Basic Auth)
    auth_str = f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}"
    auth_b64 = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
    req.add_header("Authorization", f"Basic {auth_b64}")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print(f"✓ Twilio message sent successfully: {res_body}")
            return True
    except Exception as e:
        print(f"⚠ Error sending Twilio message: {e}")
        return False

def send_meta_whatsapp(to_number: str, body: str) -> bool:
    """
    Sends direct interactive WhatsApp message reply using official Meta Cloud API.
    """
    # If not configured, print to logs so we can verify flows during testing
    if not META_ACCESS_TOKEN or not META_PHONE_NUMBER_ID:
        print(f"⚠ Meta credentials not configured. Mock Send: To={to_number}, Body={body}")
        return True
        
    # Clean phone number (Meta requires only digits with country code, no + or whatsapp: prefix)
    clean_number = "".join(c for c in to_number if c.isdigit())
    
    url = f"https://graph.facebook.com/v18.0/{META_PHONE_NUMBER_ID}/messages"
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_number,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": body
        }
    }
    
    data = json.dumps(payload).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {META_ACCESS_TOKEN}")
    req.add_header("Content-Type", "application/json")
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            print(f"✓ Meta message sent successfully: {res_body}")
            return True
    except Exception as e:
        print(f"⚠ Error sending Meta message: {e}")
        return False

def handle_chatbot_message(from_number: str, message_text: str, client_name: str = None) -> str:
    """
    Dialogue Engine State Machine for Meta WhatsApp Chatbot.
    States:
      - 0: Greeting & Service selection catalog list
      - 1: Stylist selection catalog list
      - 2: Date/time slot input
      - 3: Booking summary & confirmation response
    """
    clean_input = message_text.strip()
    lower_input = clean_input.lower()
    
    # Global commands to restart the booking flow
    if lower_input in ["restart", "cancel", "reset"]:
        database.delete_chatbot_session(from_number)
        reply = "Booking session reset. Send 'hello' to start booking an appointment again!"
        send_meta_whatsapp(from_number, reply)
        return reply
        
    session = database.get_chatbot_session(from_number)
    
    # State 0: Greeting and listing services
    if not session:
        # Fetch active services from DB
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, base_price, duration_minutes FROM services WHERE is_active = 1")
        services = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
        if not services:
            reply = "Welcome to Master Stylist Salon! Unfortunately, we are not offering any services at the moment."
            send_meta_whatsapp(from_number, reply)
            return reply
            
        # Build service options list
        options_list = []
        for index, s in enumerate(services, 1):
            options_list.append(f"{index}. {s['name']} (Price: INR {s['base_price']:.2f}, Duration: {s['duration_minutes']} mins)")
            
        services_text = "\n".join(options_list)
        reply = (
            f"Welcome to Master Stylist Salon! ✂️\n\n"
            f"Please select a service by replying with the corresponding number:\n\n"
            f"{services_text}\n\n"
            f"Reply 'cancel' at any time to cancel."
        )
        
        # Save state 0 in database
        database.save_chatbot_session(from_number, current_state=0)
        send_meta_whatsapp(from_number, reply)
        return reply
        
    current_state = session["current_state"]
    
    # State 0 -> Transitioning to State 1 (Stylist selection)
    if current_state == 0:
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, base_price, duration_minutes FROM services WHERE is_active = 1")
        services = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
        selected_idx = None
        try:
            val = int(clean_input)
            if 1 <= val <= len(services):
                selected_idx = val - 1
        except ValueError:
            pass
            
        if selected_idx is None:
            reply = "Invalid service selection. Please select by replying with a valid number from the list."
            send_meta_whatsapp(from_number, reply)
            return reply
            
        selected_service = services[selected_idx]
        
        # Fetch active staff from DB
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, first_name, last_name, specialty FROM staff WHERE is_active = 1")
        staff_members = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
        # Build staff list options
        options_list = []
        for index, st in enumerate(staff_members, 1):
            specialty_str = f" ({st['specialty']})" if st['specialty'] else ""
            options_list.append(f"{index}. {st['first_name']} {st['last_name']}{specialty_str}")
        options_list.append(f"{len(staff_members) + 1}. Any Available Stylist")
        
        staff_text = "\n".join(options_list)
        reply = (
            f"Great choice: {selected_service['name']}!\n\n"
            f"Who would you like to book with? Reply with the corresponding number:\n\n"
            f"{staff_text}"
        )
        
        # Update session: state=1, service_id=selected_service['id']
        database.save_chatbot_session(
            from_number, 
            current_state=1, 
            service_id=selected_service['id']
        )
        send_meta_whatsapp(from_number, reply)
        return reply
        
    # State 1 -> Transitioning to State 2 (DateTime selection)
    elif current_state == 1:
        # Fetch active staff
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, first_name, last_name, specialty FROM staff WHERE is_active = 1")
        staff_members = [dict(r) for r in cursor.fetchall()]
        conn.close()
        
        selected_idx = None
        is_any_stylist = False
        try:
            val = int(clean_input)
            if val == len(staff_members) + 1:
                is_any_stylist = True
            elif 1 <= val <= len(staff_members):
                selected_idx = val - 1
        except ValueError:
            pass
            
        if selected_idx is None and not is_any_stylist:
            reply = "Invalid stylist selection. Please reply with a valid number from the list."
            send_meta_whatsapp(from_number, reply)
            return reply
            
        selected_staff_id = None if is_any_stylist else staff_members[selected_idx]['id']
        
        reply = (
            f"Got it! Please enter the date and time you'd like to book.\n"
            f"Use the format YYYY-MM-DD HH:MM (e.g. 2026-05-28 15:30):"
        )
        
        # Update session: state=2, staff_id=selected_staff_id
        database.save_chatbot_session(
            from_number,
            current_state=2,
            service_id=session["selected_service_id"],
            staff_id=selected_staff_id
        )
        send_meta_whatsapp(from_number, reply)
        return reply
        
    # State 2 -> Transitioning to State 3 (Confirmation summary)
    elif current_state == 2:
        try:
            # Parse datetime string validation
            parsed_dt = datetime.strptime(clean_input, "%Y-%m-%d %H:%M")
            if parsed_dt < datetime.now():
                reply = "The selected datetime is in the past. Please enter a future date and time (format: YYYY-MM-DD HH:MM):"
                send_meta_whatsapp(from_number, reply)
                return reply
        except ValueError:
            reply = "Invalid date and time format. Please enter in the format YYYY-MM-DD HH:MM (e.g. 2026-05-28 15:30):"
            send_meta_whatsapp(from_number, reply)
            return reply
            
        # Format service name & price
        conn = database.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT name, base_price FROM services WHERE id = ?", (session["selected_service_id"],))
        service_row = cursor.fetchone()
        
        service_name = service_row['name'] if service_row else "Selected Service"
        service_price = service_row['base_price'] if service_row else 0.0
        
        # Format staff name
        staff_name = "Any Available Stylist"
        if session["selected_staff_id"]:
            cursor.execute("SELECT first_name, last_name FROM staff WHERE id = ?", (session["selected_staff_id"],))
            staff_row = cursor.fetchone()
            if staff_row:
                staff_name = f"{staff_row['first_name']} {staff_row['last_name']}"
                
        conn.close()
        
        reply = (
            f"Please confirm your booking details:\n\n"
            f"✂ Service: {service_name}\n"
            f"👤 Stylist: {staff_name}\n"
            f"📅 Date & Time: {clean_input}\n"
            f"💰 Price: INR {service_price:.2f}\n\n"
            f"Reply 'Y' to confirm booking or 'N' to cancel."
        )
        
        # Update session: state=3, datetime=clean_input
        database.save_chatbot_session(
            from_number,
            current_state=3,
            service_id=session["selected_service_id"],
            staff_id=session["selected_staff_id"],
            datetime_str=clean_input
        )
        send_meta_whatsapp(from_number, reply)
        return reply
        
    # State 3 -> Confirmation execution and booking write
    elif current_state == 3:
        if lower_input in ["y", "yes", "confirm"]:
            # Perform registration and insert booking
            # Split client name from Meta if available
            first_name = "WhatsApp"
            last_name = "Client"
            if client_name:
                parts = client_name.strip().split(" ", 1)
                first_name = parts[0]
                if len(parts) > 1:
                    last_name = parts[1]
                else:
                    last_name = f"({from_number})"
                    
            # Get or create client ID
            client_id = database.get_or_create_client(first_name, last_name, from_number)
            
            # Retrieve service base price
            conn = database.get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT name, base_price, duration_minutes FROM services WHERE id = ?", (session["selected_service_id"],))
            service_row = cursor.fetchone()
            service_name = service_row['name'] if service_row else "Service"
            base_price = service_row['base_price'] if service_row else 0.0
            
            # Format staff name for calendar and notes
            staff_name = "Any Available Stylist"
            if session["selected_staff_id"]:
                cursor.execute("SELECT first_name, last_name FROM staff WHERE id = ?", (session["selected_staff_id"],))
                staff_row = cursor.fetchone()
                if staff_row:
                    staff_name = f"{staff_row['first_name']} {staff_row['last_name']}"
                    
            # Create scheduled appointment in SQLite
            cursor.execute("""
            INSERT INTO appointments (client_id, staff_id, service_id, appointment_datetime, status, total_price)
            VALUES (?, ?, ?, ?, 'scheduled', ?)
            """, (
                client_id, 
                session["selected_staff_id"], 
                session["selected_service_id"], 
                session["selected_datetime"], 
                base_price
            ))
            appointment_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            # Mock Google Calendar Internal Alerting Sync (Log event creation)
            print(f"[CALENDAR SYNC MOCK] Event Sync: Appt #{appointment_id} | Client: {first_name} {last_name} | Service: {service_name} | Stylist: {staff_name} | Time: {session['selected_datetime']}")
            
            # Delete session from database
            database.delete_chatbot_session(from_number)
            
            reply = (
                f"🎉 Awesome! Your appointment has been booked successfully!\n\n"
                f"Booking Reference: Appt #{appointment_id}\n"
                f"Service: {service_name}\n"
                f"Stylist: {staff_name}\n"
                f"Date & Time: {session['selected_datetime']}\n\n"
                f"We look forward to styling you!"
            )
            send_meta_whatsapp(from_number, reply)
            return reply
            
        elif lower_input in ["n", "no", "cancel"]:
            # Delete session and return cancel text
            database.delete_chatbot_session(from_number)
            reply = "Booking cancelled. Feel free to text 'hello' whenever you'd like to book an appointment again."
            send_meta_whatsapp(from_number, reply)
            return reply
        else:
            reply = "Invalid response. Please reply with 'Y' to confirm booking or 'N' to cancel."
            send_meta_whatsapp(from_number, reply)
            return reply
            
    return "Session state error."
