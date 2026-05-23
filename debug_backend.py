#!/usr/bin/env python3
"""
Debug script to run the backend with detailed logging to a file
"""

import os
import sys
import logging
from pathlib import Path

# Add the backend directory to the path
backend_path = Path(__file__).parent / 'backend'
sys.path.insert(0, str(backend_path))

# Set up logging to file
log_file = Path(__file__).parent / 'backend_debug.log'
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Main function to run the backend with debug logging"""
    logger.info("Starting Salon AI Recommendation Backend in DEBUG mode")
    logger.info(f"Log file: {log_file}")

    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv(backend_path / '.env')

    # Log environment variables (without exposing secrets)
    logger.info("Environment variables loaded:")
    logger.info(f"  GEMINI_API_KEY: {'SET' if os.getenv('GEMINI_API_KEY') else 'NOT SET'}")
    logger.info(f"  USE_VERTEX_AI: {os.getenv('USE_VERTEX_AI', 'false')}")
    logger.info(f"  VERTEX_AI_PROJECT: {os.getenv('VERTEX_AI_PROJECT', 'NOT SET')}")
    logger.info(f"  VERTEX_AI_LOCATION: {os.getenv('VERTEX_AI_LOCATION', 'us-central1')}")
    logger.info(f"  GOOGLE_APPLICATION_CREDENTIALS: {os.getenv('GOOGLE_APPLICATION_CREDENTIALS', 'NOT SET')}")

    # Import and run the main application
    try:
        logger.info("Importing main application...")
        from main import app
        logger.info("Main application imported successfully")

        # Log the configuration from main.py
        from main import (
            USE_VERTEX_AI,
            VERTEX_AI_PROJECT,
            VERTEX_AI_LOCATION,
            VERTEX_AI_AVAILABLE,
            vertex_ai_available,
            genai_client,
            gemini_analysis_model,
            gemini_image_model,
            image_generation_available
        )

        logger.info("Backend configuration:")
        logger.info(f"  USE_VERTEX_AI: {USE_VERTEX_AI}")
        logger.info(f"  VERTEX_AI_PROJECT: {VERTEX_AI_PROJECT}")
        logger.info(f"  VERTEX_AI_LOCATION: {VERTEX_AI_LOCATION}")
        logger.info(f"  VERTEX_AI_AVAILABLE: {VERTEX_AI_AVAILABLE}")
        logger.info(f"  vertex_ai_available: {vertex_ai_available}")
        logger.info(f"  genai_client: {'SET' if genai_client else 'NOT SET'}")
        logger.info(f"  gemini_analysis_model: {'SET' if gemini_analysis_model else 'NOT SET'}")
        logger.info(f"  gemini_image_model: {'SET' if gemini_image_model else 'NOT SET'}")
        logger.info(f"  image_generation_available: {image_generation_available}")

        # Start the server
        logger.info("Starting Uvicorn server on http://0.0.0.0:8000")
        import uvicorn
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            reload=False,  # Disable reload for cleaner logging
            log_level="debug"
        )

    except Exception as e:
        logger.error(f"Failed to start backend: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()