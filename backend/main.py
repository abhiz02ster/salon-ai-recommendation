"""
Salon AI Hair Styling Recommendation System - Application Entrypoint
"""

import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
import app.database as database
import app.api.routes as routes

# Initialize Database
database.init_db()
print("✓ Local SQLite database initialized")

app = FastAPI(
    title="Salon AI Hair Styling Recommendation API",
    description="AI-powered hair styling recommendations using Collaborating Agents (Antigravity SDK) & SQLite History",
    version="2.0.0"
)

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static frontend directory
frontend_dir = os.path.join(settings.BASE_DIR, "frontend")
if os.path.exists(frontend_dir):
    app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend")
    print(f"✓ Mounted frontend directory from {frontend_dir}")
else:
    print(f"⚠ Frontend directory not found at {frontend_dir}")

# Mount the static client photos directory
if os.path.exists(settings.PHOTOS_DIR):
    app.mount("/data/photos", StaticFiles(directory=settings.PHOTOS_DIR), name="photos")
    print(f"✓ Mounted client photos static directory from {settings.PHOTOS_DIR}")
else:
    os.makedirs(settings.PHOTOS_DIR, exist_ok=True)
    app.mount("/data/photos", StaticFiles(directory=settings.PHOTOS_DIR), name="photos")
    print(f"✓ Created and mounted client photos static directory from {settings.PHOTOS_DIR}")

# Include API Router
app.include_router(routes.router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)