#!/bin/bash
# Helper script to open frontend in default browser

echo "Opening Salon AI Recommendation Frontend..."
echo "Make sure the backend is running on http://localhost:8000"

# Detect OS and open appropriate browser
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open "http://localhost:8000/frontend/index.html"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open "http://localhost:8000/frontend/index.html"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows
    start "http://localhost:8000/frontend/index.html"
else
    echo "Please open your browser and navigate to: http://localhost:8000/frontend/index.html"
fi