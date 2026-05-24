import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings:
    # Vertex AI configuration
    USE_VERTEX_AI: bool = os.getenv("USE_VERTEX_AI", "true").lower() == "true"
    VERTEX_AI_PROJECT: str = os.getenv("VERTEX_AI_PROJECT")
    VERTEX_AI_LOCATION: str = os.getenv("VERTEX_AI_LOCATION", "us-central1")
    
    # Path configurations (resolved relative to this file's position)
    APP_DIR = os.path.dirname(os.path.abspath(__file__))               # backend/app/
    BACKEND_DIR = os.path.dirname(APP_DIR)                             # backend/
    BASE_DIR = os.path.dirname(BACKEND_DIR)                            # project root/
    
    DB_PATH: str = os.path.join(BASE_DIR, "salon_management.db")
    SCHEMA_PATH: str = os.path.join(BASE_DIR, "database_schema.sql")
    PHOTOS_DIR: str = os.path.join(BACKEND_DIR, "data", "photos")

settings = Settings()
