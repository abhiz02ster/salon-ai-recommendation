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
    
    # Create a default walk-in client if clients table is empty
    cursor.execute("SELECT COUNT(*) FROM clients")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
        INSERT INTO clients (first_name, last_name, gender, is_active)
        VALUES ('Walk-in', 'Client', 'Other', 1)
        """)
        print("✓ Created default Walk-in Client in database")
        
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
    SELECT c.*, cl.first_name, cl.last_name
    FROM client_consultations c
    JOIN clients cl ON c.client_id = cl.id
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
    SELECT c.*, cl.first_name, cl.last_name
    FROM client_consultations c
    JOIN clients cl ON c.client_id = cl.id
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
    SELECT c.*, cl.first_name, cl.last_name
    FROM client_consultations c
    JOIN clients cl ON c.client_id = cl.id
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
