# Salon AI Hair Styling Recommendation System

This project provides an AI-powered hair styling recommendation system for salons, featuring:

- AI analysis of client photos for face shape, hair type, and skin tone
- Personalized hair styling recommendations based on client attributes
- Responsive web interface for tablet/iPad use in salon settings
- FastAPI backend for processing and recommendations
- Extensible design for integration with full salon management system

## Features

### Backend (FastAPI)
- Image analysis endpoints for face shape, hair type, and skin tone detection
- Recommendation engine based on client attributes and AI analysis
- RESTful API for frontend communication
- Health check and documentation endpoints

### Frontend (HTML/CSS/JavaScript)
- Responsive design optimized for tablet/iPad use
- Image upload and preview functionality
- Client attribute input forms
- Real-time recommendation display
- Loading states and error handling

## Project Structure

```
salon-ai-recommendation/
├── backend/
│   ├── main.py              # FastAPI application
│   └── requirements.txt     # Python dependencies
├── frontend/
│   └── index.html           # Main frontend interface
├── database_schema.sql      # Complete database schema for salon management
├── inventory_extensions.py  # Extensions to existing inventory system
└── README.md                # This file
```

## Installation

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd salon-ai-recommendation/backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup
1. Simply open `frontend/index.html` in a web browser
2. Ensure the backend is running on `http://localhost:8000`
3. The frontend will automatically connect to the backend API

## API Endpoints

### POST `/analyze`
Analyze client photo and attributes to generate hair styling recommendations.

**Form Data:**
- `file`: Image file (JPG, PNG)
- `height`: Client height in cm (optional)
- `face_shape`: Face shape (oval, round, square, heart, diamond, oblong) (optional)
- `body_type`: Body type (ectomorph, mesomorph, endomorph) (optional)
- `hair_type`: Hair type (straight, wavy, curly, coily) (optional)
- `hair_length`: Hair length (short, medium, long) (optional)
- `skin_tone`: Skin tone (fair, light, medium, tan, deep) (optional)

**Response:**
```json
{
  "recommendations": [
    {
      "style_name": "Layered Lob",
      "description": "Versatile layered cut that hits just above shoulders",
      "suitability_score": 95.0,
      "reasoning": ["Oval face suits most styles", "Layers add movement and volume"],
      "maintenance_tips": ["Use texturizing spray for definition", "Trim every 8-12 weeks"],
      "products_needed": ["Texturizing spray", "Lightweight mousse"],
      "visualization_url": null
    }
  ],
  "analysis_details": {
    "face_analysis": {/* analysis results */},
    "hair_analysis": {/* analysis results */},
    "skin_analysis": {/* analysis results */},
    "client_attributes": {/* provided attributes */}
  },
  "timestamp": "2026-05-21T10:30:00Z"
}
```

### GET `/health`
Health check endpoint.

### GET `/`
Root endpoint with service information.

## Usage in Salon

1. Launch the backend server on a salon computer or local network device
2. Open the frontend interface on a tablet/iPad
3. Capture or upload client photo
4. Input client attributes (height, face shape, etc.) or let AI detect them
5. Click "Analyze & Get Recommendations"
6. Review personalized hair styling recommendations with styling tips and product suggestions
7. Use recommendations to guide consultation and service selection

## Integration with Full Salon Management System

This AI recommendation system is designed to integrate with a complete salon management system that includes:

- Client management (profiles, history, preferences)
- Appointment scheduling
- Service catalog and pricing
- Inventory management (products and materials)
- Point of sale and billing
- Reporting and analytics
- Marketing and loyalty programs

See `database_schema.sql` for the complete database schema and `inventory_extensions.py` for extensions to the existing inventory management system.

## Customization

### Adjusting Recommendation Logic
Modify the `generate_hair_recommendations` function in `backend/main.py` to change how recommendations are generated based on analysis results.

### Adding New Analysis Features
Enhance the analysis functions (`analyze_face_shape`, `analyze_hair_type`, `analyze_skin_tone`) to use more sophisticated ML models or computer vision techniques.

### Styling Customization
Update the CSS in `frontend/index.html` to match salon branding or adjust the UI layout.

## Future Enhancements

1. **Virtual Try-On**: Integrate AR/virtual try-on technology for clients to see recommendations on themselves
2. **Advanced ML Models**: Replace mock analysis functions with trained deep learning models
3. **Product Integration**: Link recommendations to salon inventory for automatic product suggestions
4. **Appointment Integration**: Save recommendations to client profiles and appointment history
5. **Multi-language Support**: Add support for multiple languages in the interface
6. **Offline Capability**: Enable local processing for use in salons with limited internet connectivity

## Notes

- The current implementation uses mock analysis functions for demonstration purposes
- For production use, replace mock functions with actual ML models or API calls to computer vision services
- Ensure proper image privacy and data handling practices are followed
- Consider rate limiting and authentication for the API in production deployments