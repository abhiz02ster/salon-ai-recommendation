#!/bin/bash
# Startup script for Salon AI Recommendation Backend

echo "Starting Salon AI Hair Styling Recommendation Backend..."

# Check if virtual environment exists, if not create one
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Start the server
echo "Starting server on http://localhost:8000"
echo "Press Ctrl+C to stop"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload