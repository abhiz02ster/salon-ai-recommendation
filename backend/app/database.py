import sqlite3
import json
import os
from datetime import datetime
from app.config import settings

def get_db():
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database from schema and add custom consultation tables if not present"""
    # Create photos directory
    os.makedirs(settings.PHOTOS_DIR, exist_ok=True)
    
    # Initialize from database_schema.sql if DB doesn't exist
    db_is_new = not os.path.exists(settings.DB_PATH)
    conn = get_db()
    cursor = conn.cursor()
    
    if db_is_new or True:  # Run schema initialization safety checks
        if os.path.exists(settings.SCHEMA_PATH):
            with open(settings.SCHEMA_PATH, "r") as f:
                schema_sql = f.read()
            try:
                cursor.executescript(schema_sql)
                conn.commit()
                print("✓ Database schema initialized successfully")
            except Exception as e:
                print(f"⚠ Schema execution warning (tables may already exist): {e}")
        else:
            print("⚠ Schema file database_schema.sql not found, skipped init")

    # Create the client_consultations table for tracking session history
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS client_consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        photos TEXT, -- JSON containing paths to captured front, left, right photos
        recommendations TEXT, -- JSON of styling suggestions & visual media
        conversation_history TEXT, -- JSON array of refinements/chat history
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
    """)

    # Create the client_confirmed_styles table for selection tracking
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS client_confirmed_styles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        consultation_id INTEGER NOT NULL UNIQUE,
        style_name VARCHAR(100) NOT NULL,
        confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (consultation_id) REFERENCES client_consultations(id) ON DELETE CASCADE
    );
    """)
    
    # Create a default walk-in client if clients table is empty
    cursor.execute("SELECT COUNT(*) FROM clients")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO clients (first_name, last_name, phone, gender, is_active)
        VALUES ('Walk-in', 'Client', '9999999999', 'Other', 1)
        """)
        walkin_id = cursor.lastrowid
        cursor.execute("""
        INSERT INTO client_profiles (client_id, hair_density, hair_porosity, hair_elasticity, natural_color, scalp_type, typical_maintenance)
        VALUES (?, 'medium', 'medium', 'normal', 'Black', 'normal', 'low')
        """, (walkin_id,))
        print("✓ Created default Walk-in Client & profile in database")

    # Create default staff if staff table is empty
    cursor.execute("SELECT COUNT(*) FROM staff")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO staff (first_name, last_name, specialty, email, phone, is_active)
        VALUES ('Priya', 'Sharma', 'Color Specialist', 'priya@salonai.com', '9811122233', 1)
        """)
        cursor.execute("""
        INSERT INTO staff (first_name, last_name, specialty, email, phone, is_active)
        VALUES ('Rahul', 'Kumar', 'Hairstyle & Cutting Expert', 'rahul@salonai.com', '9811144455', 1)
        """)
        print("✓ Created sample staff members in database")

    # Create default services if services table is empty
    cursor.execute("SELECT COUNT(*) FROM services")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO services (name, category, description, duration_minutes, base_price, is_active)
        VALUES ('Haircut & Styling', 'styling', 'Premium hair consultation, haircut, and styling.', 45, 800.00, 1)
        """)
        haircut_service_id = cursor.lastrowid
        cursor.execute("""
        INSERT INTO services (name, category, description, duration_minutes, base_price, is_active)
        VALUES ('Hair Coloring', 'color', 'Root touchup and full hair dye coloring.', 120, 1500.00, 1)
        """)
        color_service_id = cursor.lastrowid
        
        # Link staff services
        cursor.execute("INSERT INTO staff_services (staff_id, service_id, proficiency_level) VALUES (1, ?, 'expert')", (color_service_id,))
        cursor.execute("INSERT INTO staff_services (staff_id, service_id, proficiency_level) VALUES (2, ?, 'expert')", (haircut_service_id,))
        print("✓ Created sample services and linked staff capabilities in database")

    # Create default suppliers if suppliers table is empty
    cursor.execute("SELECT COUNT(*) FROM suppliers")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO suppliers (name, contact_person, phone, email, address, city, state, payment_terms, is_active)
        VALUES ('L''Oreal Professional', 'Amit Patel', '9811122233', 'orders@lorealpro.in', 'Plot 12, Sector 5', 'Gurugram', 'Haryana', 'Net 30', 1)
        """)
        cursor.execute("""
        INSERT INTO suppliers (name, contact_person, phone, email, address, city, state, payment_terms, is_active)
        VALUES ('Wella India', 'Neha Mehta', '9811144455', 'support@wella.in', 'Tower B, Ground Floor', 'Mumbai', 'Maharashtra', 'COD', 1)
        """)
        print("✓ Created sample suppliers in database")

    # Create default products if products table is empty
    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO products (sku, name, description, category, cost_price, selling_price, stock, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('LOP-SH-250', 'L''Oreal Hydrating Shampoo', 'Professional hydrating argan oil shampoo', 'retail', 450.00, 699.00, 8, 1, 'hair_care', 'L''Oreal', '250ml', 0, 3, 10, 1)
        """)
        cursor.execute("""
        INSERT INTO products (sku, name, description, category, cost_price, selling_price, stock, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('LOP-CD-250', 'L''Oreal Color Protect Conditioner', 'Protective conditioner for colored hair', 'retail', 500.00, 749.00, 2, 1, 'hair_care', 'L''Oreal', '250ml', 0, 4, 8, 1)
        """)
        cursor.execute("""
        INSERT INTO products (sku, name, description, category, cost_price, selling_price, stock, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('LOP-SR-100', 'L''Oreal Absolut Repair Hair Serum', 'Deep repairing hair serum for dry hair', 'retail', 650.00, 950.00, 1, 1, 'styling', 'L''Oreal', '100ml', 0, 3, 5, 1)
        """)
        cursor.execute("""
        INSERT INTO products (sku, name, description, category, cost_price, selling_price, stock, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('SKP-GL-150', 'Schwarzkopf OSIS+ Styling Gel', 'Strong hold hair styling gel', 'retail', 380.00, 580.00, 12, 1, 'styling', 'Schwarzkopf', '150ml', 0, 3, 10, 2)
        """)
        cursor.execute("""
        INSERT INTO products (sku, name, description, category, cost_price, selling_price, stock, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('LOP-OB-500', 'L''Oreal Professional Styling Spray', 'Professional salon strong hair spray', 'backbar', 800.00, NULL, 5, 1, 'styling', 'L''Oreal', '500ml', 1, 2, 5, 1)
        """)
        print("✓ Created sample products in database")

    # Create default materials if materials table is empty
    cursor.execute("SELECT COUNT(*) FROM materials")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO materials (name, description, category, quantity, unit, unit_cost, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('Wella Illumina Color Dye 7/81', 'Medium blonde pearl ash dye tube', 'raw_material', 320.0, 'g', 5.50, 1, 'hair_color', 'Wella', '60g', 1, 120.0, 240.0, 2)
        """)
        cursor.execute("""
        INSERT INTO materials (name, description, category, quantity, unit, unit_cost, is_active, salon_category, brand, size_volume, is_professional_use, minimum_stock_level, reorder_quantity, supplier_id)
        VALUES ('Wella Welloxon Developer 20Vol', 'Oxidizing developer cream 6%', 'raw_material', 950.0, 'ml', 0.80, 1, 'developer', 'Wella', '1000ml', 1, 1000.0, 2000.0, 2)
        """)
        print("✓ Created sample materials in database")
        
    conn.commit()
    conn.close()

def save_photos(front_bytes: bytes, left_bytes: bytes, right_bytes: bytes) -> dict:
    """Save captured photos to disk and return their relative paths (relative to backend/)"""
    os.makedirs(settings.PHOTOS_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    paths = {}
    if front_bytes:
        filename = f"client_front_{timestamp}.jpg"
        abs_path = os.path.join(settings.PHOTOS_DIR, filename)
        with open(abs_path, "wb") as f:
            f.write(front_bytes)
        paths["front"] = f"data/photos/{filename}"
        
    if left_bytes:
        filename = f"client_left_{timestamp}.jpg"
        abs_path = os.path.join(settings.PHOTOS_DIR, filename)
        with open(abs_path, "wb") as f:
            f.write(left_bytes)
        paths["left"] = f"data/photos/{filename}"
        
    if right_bytes:
        filename = f"client_right_{timestamp}.jpg"
        abs_path = os.path.join(settings.PHOTOS_DIR, filename)
        with open(abs_path, "wb") as f:
            f.write(right_bytes)
        paths["right"] = f"data/photos/{filename}"
        
    return paths

def create_consultation(client_id: int, photos: dict, recommendations: dict, conversation_history: list) -> int:
    """Create a new consultation record"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO client_consultations (client_id, photos, recommendations, conversation_history)
    VALUES (?, ?, ?, ?)
    """, (
        client_id,
        json.dumps(photos),
        json.dumps(recommendations),
        json.dumps(conversation_history)
    ))
    consultation_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return consultation_id

def update_consultation_history(consultation_id: int, recommendations: dict, conversation_history: list):
    """Update recommendations and chat history for a consultation after refinement"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE client_consultations
    SET recommendations = ?, conversation_history = ?
    WHERE id = ?
    """, (
        json.dumps(recommendations),
        json.dumps(conversation_history),
        consultation_id
    ))
    conn.commit()
    conn.close()

def get_consultation(consultation_id: int) -> dict:
    """Retrieve a single consultation by ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT c.*, cl.first_name, cl.last_name, cs.style_name AS confirmed_style
    FROM client_consultations c
    JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN client_confirmed_styles cs ON c.id = cs.consultation_id
    WHERE c.id = ?
    """, (consultation_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        res["photos"] = json.loads(res["photos"])
        res["recommendations"] = json.loads(res["recommendations"])
        res["conversation_history"] = json.loads(res["conversation_history"])
        return res
    return None

def get_client_history(client_id: int) -> list:
    """Retrieve all consultations for a client, sorted by date descending"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT c.*, cl.first_name, cl.last_name, cs.style_name AS confirmed_style
    FROM client_consultations c
    JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN client_confirmed_styles cs ON c.id = cs.consultation_id
    WHERE c.client_id = ?
    ORDER BY c.created_at DESC
    """, (client_id,))
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        item = dict(r)
        item["photos"] = json.loads(item["photos"])
        item["recommendations"] = json.loads(item["recommendations"])
        item["conversation_history"] = json.loads(item["conversation_history"])
        history.append(item)
    return history

def get_all_consultations() -> list:
    """Retrieve all consultations in the database for the sidebar history"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT c.*, cl.first_name, cl.last_name, cs.style_name AS confirmed_style
    FROM client_consultations c
    JOIN clients cl ON c.client_id = cl.id
    LEFT JOIN client_confirmed_styles cs ON c.id = cs.consultation_id
    ORDER BY c.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for r in rows:
        item = dict(r)
        item["photos"] = json.loads(item["photos"])
        item["recommendations"] = json.loads(item["recommendations"])
        item["conversation_history"] = json.loads(item["conversation_history"])
        history.append(item)
    return history

def get_or_create_client(first_name: str, last_name: str, phone: str) -> int:
    """Check in a client: retrieve ID if phone number exists, otherwise create a new one"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Standardize phone number by stripping spaces or common characters
    clean_phone = phone.strip()
    
    cursor.execute("SELECT id FROM clients WHERE phone = ? OR (first_name = ? AND last_name = ? AND phone = ?)", (clean_phone, first_name, last_name, clean_phone))
    row = cursor.fetchone()
    
    if row:
        client_id = row[0]
        # Update name in case it changed or wasn't set correctly
        cursor.execute("UPDATE clients SET first_name = ?, last_name = ? WHERE id = ?", (first_name, last_name, client_id))
    else:
        cursor.execute("""
        INSERT INTO clients (first_name, last_name, phone, is_active)
        VALUES (?, ?, ?, 1)
        """, (first_name, last_name, clean_phone))
        client_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return client_id

def log_style_selection(client_id: int, consultation_id: int, style_name: str) -> int:
    """Log style confirmation from recommendation card"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Try inserting. If already exists (UNIQUE constraint on consultation_id), update it.
    cursor.execute("SELECT id FROM client_confirmed_styles WHERE consultation_id = ?", (consultation_id,))
    row = cursor.fetchone()
    
    if row:
        confirmed_id = row[0]
        cursor.execute("UPDATE client_confirmed_styles SET style_name = ? WHERE id = ?", (style_name, confirmed_id))
    else:
        cursor.execute("""
        INSERT INTO client_confirmed_styles (client_id, consultation_id, style_name)
        VALUES (?, ?, ?)
        """, (client_id, consultation_id, style_name))
        confirmed_id = cursor.lastrowid
        
    conn.commit()
    conn.close()
    return confirmed_id

def get_clients() -> list:
    """Retrieve all clients with basic details"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, first_name, last_name, phone, email, total_visits, total_spent, last_visit_date, is_active
    FROM clients
    ORDER BY first_name, last_name
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_client_profile(client_id: int) -> dict:
    """Retrieve full client profile attributes, allergies, and color formulas"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get client basic details and profile
    cursor.execute("""
    SELECT c.id AS client_id, c.first_name, c.last_name, c.phone, c.email, c.allergies AS client_allergies,
           p.hair_density, p.hair_porosity, p.hair_elasticity, p.natural_color, p.scalp_type,
           p.chemical_treatment_history, p.allergies AS profile_allergies, p.typical_maintenance
    FROM clients c
    LEFT JOIN client_profiles p ON c.id = p.client_id
    WHERE c.id = ?
    """, (client_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return None
        
    client_data = dict(row)
    
    # Standardize allergies (merge clients.allergies and client_profiles.allergies)
    allergies_list = []
    for field in ['client_allergies', 'profile_allergies']:
        val = client_data.get(field)
        if val:
            parts = [p.strip() for p in val.split(',') if p.strip()]
            for p in parts:
                if p not in allergies_list:
                    allergies_list.append(p)
    
    # Remove raw allergy keys to return a single structured field
    client_data['allergies'] = ", ".join(allergies_list)
    client_data.pop('client_allergies', None)
    client_data.pop('profile_allergies', None)
    
    # Retrieve color formulas from stylist_notes of type 'formula'
    cursor.execute("""
    SELECT n.created_at AS date, n.content AS formula, (s.first_name || ' ' || s.last_name) AS stylist_name
    FROM stylist_notes n
    JOIN staff s ON n.stylist_id = s.id
    JOIN appointments a ON n.appointment_id = a.id
    WHERE a.client_id = ? AND n.note_type = 'formula'
    ORDER BY n.created_at DESC
    """, (client_id,))
    formulas = cursor.fetchall()
    client_data['color_formulas'] = [dict(f) for f in formulas]
    
    # Fetch style history
    cursor.execute("""
    SELECT h.created_at AS date, h.recommended_style, h.actual_service, h.satisfaction_score, h.notes
    FROM client_style_history h
    WHERE h.client_id = ?
    ORDER BY h.created_at DESC
    """, (client_id,))
    history = cursor.fetchall()
    client_data['style_history'] = [dict(h) for h in history]
    
    conn.close()
    return client_data

def update_client_profile(client_id: int, profile_data: dict) -> bool:
    """Update a client's physical hair metrics, allergies, and typical maintenance commitments"""
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Update clients table fields (email, phone, allergies)
    client_updates = []
    client_params = []
    if 'email' in profile_data:
        client_updates.append("email = ?")
        client_params.append(profile_data['email'])
    if 'phone' in profile_data:
        client_updates.append("phone = ?")
        client_params.append(profile_data['phone'])
    if 'allergies' in profile_data:
        client_updates.append("allergies = ?")
        client_params.append(profile_data['allergies'])
        
    if client_updates:
        client_params.append(client_id)
        cursor.execute(f"UPDATE clients SET {', '.join(client_updates)} WHERE id = ?", client_params)
        
    # 2. Check if client_profile row exists
    cursor.execute("SELECT 1 FROM client_profiles WHERE client_id = ?", (client_id,))
    exists = cursor.fetchone()
    
    density = profile_data.get('hair_density')
    porosity = profile_data.get('hair_porosity')
    elasticity = profile_data.get('hair_elasticity')
    natural_color = profile_data.get('natural_color')
    scalp_type = profile_data.get('scalp_type')
    chem_history = profile_data.get('chemical_treatment_history')
    allergies = profile_data.get('allergies')
    maintenance = profile_data.get('typical_maintenance')
    
    if exists:
        cursor.execute("""
        UPDATE client_profiles
        SET hair_density = COALESCE(?, hair_density),
            hair_porosity = COALESCE(?, hair_porosity),
            hair_elasticity = COALESCE(?, hair_elasticity),
            natural_color = COALESCE(?, natural_color),
            scalp_type = COALESCE(?, scalp_type),
            chemical_treatment_history = COALESCE(?, chemical_treatment_history),
            allergies = COALESCE(?, allergies),
            typical_maintenance = COALESCE(?, typical_maintenance),
            updated_at = CURRENT_TIMESTAMP
        WHERE client_id = ?
        """, (density, porosity, elasticity, natural_color, scalp_type, chem_history, allergies, maintenance, client_id))
    else:
        cursor.execute("""
        INSERT INTO client_profiles (client_id, hair_density, hair_porosity, hair_elasticity, natural_color, scalp_type, chemical_treatment_history, allergies, typical_maintenance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (client_id, density, porosity, elasticity, natural_color, scalp_type, chem_history, allergies, maintenance))
        
    conn.commit()
    conn.close()
    return True

def create_appointment_and_update_loyalty(client_id: int, appointment_date: str, consultation_id: int, total_amount: float) -> dict:
    """
    Create a completed appointment, insert a matching completed transaction,
    which fires triggers to update client stats, and record earned loyalty points.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Fetch or create a default service for appointment mapping
    cursor.execute("SELECT id FROM services LIMIT 1")
    service_row = cursor.fetchone()
    if service_row:
        service_id = service_row[0]
    else:
        # Create a default service
        cursor.execute("""
        INSERT INTO services (name, category, description, duration_minutes, base_price)
        VALUES ('AI Consultation & Styling', 'styling', 'Consultation driven by AI recommendation', 60, ?)
        """, (total_amount,))
        service_id = cursor.lastrowid
        
    # 2. Fetch or create a default staff member
    cursor.execute("SELECT id FROM staff LIMIT 1")
    staff_row = cursor.fetchone()
    if staff_row:
        staff_id = staff_row[0]
    else:
        cursor.execute("""
        INSERT INTO staff (first_name, last_name, specialty)
        VALUES ('Master', 'AI Stylist', 'General Hair & Style Consultant')
        """)
        staff_id = cursor.lastrowid
        
    # 3. Create appointment with status 'scheduled'
    try:
        dt = datetime.fromisoformat(appointment_date.replace("Z", "")) if appointment_date else datetime.now()
    except Exception:
        dt = datetime.now()
    dt_str = dt.strftime("%Y-%m-%d %H:%M:%S")
    
    cursor.execute("""
    INSERT INTO appointments (client_id, staff_id, service_id, appointment_datetime, status, total_price)
    VALUES (?, ?, ?, ?, 'scheduled', ?)
    """, (client_id, staff_id, service_id, dt_str, total_amount))
    appointment_id = cursor.lastrowid
    
    # 4. Insert completed transaction to record payment
    receipt_num = f"REC-{datetime.now().strftime('%Y%m%d%H%M%S')}-{appointment_id}"
    cursor.execute("""
    INSERT INTO transactions (appointment_id, client_id, amount, payment_method, status, receipt_number)
    VALUES (?, ?, ?, 'card', 'completed', ?)
    """, (appointment_id, client_id, total_amount, receipt_num))
    
    # 5. Update appointment status to 'completed' so that client stats trigger executes
    cursor.execute("""
    UPDATE appointments
    SET status = 'completed', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (appointment_id,))
    
    # 6. Record stylist notes (formula note if confirmation log suggests products or color notes)
    # Get the confirmed style name from client_confirmed_styles for this consultation if it exists
    cursor.execute("SELECT style_name FROM client_confirmed_styles WHERE consultation_id = ?", (consultation_id,))
    style_row = cursor.fetchone()
    style_name = style_row[0] if style_row else "Selected Hairstyle"
    
    note_content = f"Client completed appointment for {style_name}. Total paid: INR {total_amount:.2f}."
    cursor.execute("""
    INSERT INTO stylist_notes (appointment_id, stylist_id, note_type, content)
    VALUES (?, ?, 'general', ?)
    """, (appointment_id, staff_id, note_content))
    
    # Add a formula note if appropriate
    formula_note = f"Style choice: {style_name}. Developer: 20Vol, Toner: 9.1."
    cursor.execute("""
    INSERT INTO stylist_notes (appointment_id, stylist_id, note_type, content)
    VALUES (?, ?, 'formula', ?)
    """, (appointment_id, staff_id, formula_note))
    
    # Insert client style history log
    cursor.execute("""
    INSERT INTO client_style_history (client_id, appointment_id, recommended_style, actual_service, satisfaction_score, notes)
    VALUES (?, ?, ?, ?, 5, 'Client loved the final look!')
    """, (client_id, appointment_id, style_name, style_name))
    
    # 7. Add loyalty points delta
    points_delta = int(total_amount)
    cursor.execute("""
    INSERT INTO loyalty_points (client_id, points_delta, reason)
    VALUES (?, ?, ?)
    """, (client_id, points_delta, f"Earned from Appointment #{appointment_id} Booking"))
    
    conn.commit()
    conn.close()
    
    return {
        "appointment_id": appointment_id,
        "loyalty_points_earned": points_delta,
        "status": "completed"
    }

def get_all_products(category: str = None, low_stock: bool = False) -> list:
    """Retrieve all products (retail/backbar) and materials, with filter parameters"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Query products
    prod_query = "SELECT p.*, s.name AS supplier_name FROM products p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.is_active = 1"
    prod_params = []
    
    if category:
        prod_query += " AND p.salon_category = ?"
        prod_params.append(category)
    if low_stock:
        prod_query += " AND p.stock <= p.minimum_stock_level"
        
    cursor.execute(prod_query, prod_params)
    products = [dict(r) for r in cursor.fetchall()]
    
    # Map products standard columns to uniform inventory columns
    for p in products:
        p['inventory_type'] = 'product'
        p['quantity_in_stock'] = p['stock']
        p['safety_stock_level'] = p['minimum_stock_level']
        p['status'] = 'critical' if p['stock'] <= p['minimum_stock_level'] else 'normal'
        
    # Query materials
    mat_query = "SELECT m.*, s.name AS supplier_name FROM materials m LEFT JOIN suppliers s ON m.supplier_id = s.id WHERE m.is_active = 1"
    mat_params = []
    
    if category:
        mat_query += " AND m.salon_category = ?"
        mat_params.append(category)
    if low_stock:
        mat_query += " AND m.quantity <= m.minimum_stock_level"
        
    cursor.execute(mat_query, mat_params)
    materials = [dict(r) for r in cursor.fetchall()]
    
    # Map materials standard columns to uniform inventory columns
    for m in materials:
        m['inventory_type'] = 'material'
        m['sku'] = f"MAT-{m['id']:03d}"
        m['stock'] = m['quantity']
        m['cost_price'] = m['unit_cost']
        m['quantity_in_stock'] = m['quantity']
        m['safety_stock_level'] = m['minimum_stock_level']
        m['selling_price'] = None # materials don't have selling prices
        m['status'] = 'critical' if m['quantity'] <= m['minimum_stock_level'] else 'normal'
        
    conn.close()
    return products + materials


def add_stock_transaction(item_id: int, inventory_type: str, transaction_type: str, quantity: float, performed_by: str, reference_id: int = None) -> dict:
    """Log manual inventory stock transactions and update quantity_in_stock"""
    conn = get_db()
    cursor = conn.cursor()
    
    if inventory_type == 'product':
        # Check current stock
        cursor.execute("SELECT stock FROM products WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"Product ID {item_id} not found")
        current_stock = row[0]
        new_stock = current_stock + quantity
        
        # Update products stock
        cursor.execute("UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_stock, item_id))
        
        # Log stock transaction
        cursor.execute("""
        INSERT INTO stock_transactions (product_id, transaction_type, quantity, performed_by, reference_id)
        VALUES (?, ?, ?, ?, ?)
        """, (item_id, transaction_type, quantity, performed_by, reference_id))
        
        cursor.execute("SELECT stock, minimum_stock_level FROM products WHERE id = ?", (item_id,))
        final_row = cursor.fetchone()
        final_stock, safety_level = final_row[0], final_row[1]
        alert_triggered = final_stock <= safety_level
        
    elif inventory_type == 'material':
        cursor.execute("SELECT quantity FROM materials WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"Material ID {item_id} not found")
        current_stock = row[0]
        new_stock = current_stock + quantity
        
        # Update materials quantity
        cursor.execute("UPDATE materials SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_stock, item_id))
        
        # Log stock transaction
        cursor.execute("""
        INSERT INTO stock_transactions (material_id, transaction_type, quantity, performed_by, reference_id)
        VALUES (?, ?, ?, ?, ?)
        """, (item_id, transaction_type, quantity, performed_by, reference_id))
        
        cursor.execute("SELECT quantity, minimum_stock_level FROM materials WHERE id = ?", (item_id,))
        final_row = cursor.fetchone()
        final_stock, safety_level = final_row[0], final_row[1]
        alert_triggered = final_stock <= safety_level
        
    else:
        conn.close()
        raise ValueError(f"Invalid inventory type: {inventory_type}")
        
    conn.commit()
    conn.close()
    
    return {
        "success": True,
        "new_quantity": final_stock,
        "alert_triggered": alert_triggered
    }

def get_active_alerts() -> list:
    """Retrieve all active alerts where stock is below safety levels"""
    products = get_all_products(low_stock=True)
    alerts = []
    for item in products:
        alerts.append({
            "item_id": item['id'],
            "sku": item['sku'],
            "name": item['name'],
            "inventory_type": item['inventory_type'],
            "quantity_in_stock": item['quantity_in_stock'],
            "safety_stock_level": item['safety_stock_level'],
            "supplier_name": item['supplier_name'] or "N/A",
            "reorder_quantity": item['reorder_quantity']
        })
    return alerts

def get_suppliers() -> list:
    """Retrieve all suppliers from the database"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, name, contact_person, phone, email, city, state, payment_terms, is_active
    FROM suppliers
    WHERE is_active = 1
    ORDER BY name
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def check_product_stock_and_find_alternative(product_name: str) -> dict:
    """
    Check if a product is in stock. If not, find a substitute product
    in the same salon_category that is in stock.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Search for product using fuzzy match on name or sku
    search_term = f"%{product_name}%"
    cursor.execute("""
    SELECT id, name, sku, stock, salon_category
    FROM products
    WHERE name LIKE ? OR sku LIKE ? OR ? LIKE ('%' || name || '%')
    LIMIT 1
    """, (search_term, search_term, product_name))
    row = cursor.fetchone()
    
    if row:
        product_id, name, sku, stock, salon_category = row['id'], row['name'], row['sku'], row['stock'], row['salon_category']
        if stock > 0:
            conn.close()
            return {
                "original_found": True,
                "in_stock": True,
                "product_id": product_id,
                "name": name,
                "sku": sku,
                "stock": stock
            }
        else:
            # Product is out of stock! Find a substitute in the same salon_category
            cursor.execute("""
            SELECT id, name, sku, stock
            FROM products
            WHERE salon_category = ? AND stock > 0 AND id != ?
            LIMIT 1
            """, (salon_category, product_id))
            sub_row = cursor.fetchone()
            
            if sub_row:
                sub_id, sub_name, sub_sku, sub_stock = sub_row['id'], sub_row['name'], sub_row['sku'], sub_row['stock']
                conn.close()
                return {
                    "original_found": True,
                    "in_stock": False,
                    "product_id": product_id,
                    "name": name,
                    "sku": sku,
                    "substitute_found": True,
                    "substitute_id": sub_id,
                    "substitute_name": sub_name,
                    "substitute_sku": sub_sku
                }
                
    # If product is not found in database at all, try to match by guessing category from name keywords
    category_guess = 'hair_care'
    lower_name = product_name.lower()
    if any(kw in lower_name for kw in ['spray', 'gel', 'serum', 'wax', 'paste', 'clay', 'pomade']):
        category_guess = 'styling'
    elif any(kw in lower_name for kw in ['dye', 'color', 'developer', 'bleach', 'toner']):
        category_guess = 'color'
        
    cursor.execute("""
    SELECT id, name, sku, stock
    FROM products
    WHERE salon_category = ? AND stock > 0
    LIMIT 1
    """, (category_guess,))
    sub_row = cursor.fetchone()
    
    conn.close()
    if sub_row:
        sub_id, sub_name, sub_sku, sub_stock = sub_row['id'], sub_row['name'], sub_row['sku'], sub_row['stock']
        return {
            "original_found": False,
            "in_stock": False,
            "substitute_found": True,
            "substitute_id": sub_id,
            "substitute_name": sub_name,
            "substitute_sku": sub_sku
        }
        
    return {
        "original_found": False,
        "in_stock": False,
        "substitute_found": False
    }
