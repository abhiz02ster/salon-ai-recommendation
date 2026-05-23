# Deployment Guide for Salon AI Recommendation System

## Overview
This guide covers deployment of the salon AI hair styling recommendation system in a salon environment.

## System Requirements
- **Backend Server**: Any computer capable of running Python 3.8+ (can be a salon office computer or low-cost server)
- **Frontend Devices**: Tablets or iPads (recommended: iPad Air or Android tablet with 8"+ screen)
- **Network**: Local WiFi network (internet connection optional for local processing only)
- **Storage**: Minimum 2GB free space for images and database

## Deployment Options

### Option 1: Local Salon Server (Recommended for Privacy)
All processing happens locally on salon premises.

**Hardware**:
- Desktop computer or Raspberry Pi 4 (4GB+ RAM)
- Connected to salon WiFi

**Setup**:
1. Clone the repository to the server computer
2. Run the backend startup script: `./start_backend.sh`
3. Access the frontend via browser on salon tablets: `http://[server-ip]:8000`

### Option 2: Cloud-Hosted Backend
Backend hosted in the cloud (requires internet connection).

**Services**:
- Any VPS provider (DigitalOcean, AWS Lightsail, etc.) or PythonAnywhere
- Domain name optional

**Setup**:
1. Deploy FastAPI application to cloud server
2. Configure firewall to allow port 8000 (or use reverse proxy with SSL)
3. Access via domain or IP from salon tablets

### Option 3: Hybrid Approach
Backend runs locally but uses cloud AI APIs for enhanced analysis.

## Installation Steps

### 1. Backend Installation
```bash
# Clone or copy the salon-ai-recommendation directory to your server
cd salon-ai-recommendation/backend

# Make startup script executable (if using provided script)
chmod +x start_backend.sh

# Start the system
./start_backend.sh
```

### 2. Frontend Access
On salon tablets:
1. Open Chrome, Safari, or Firefox browser
2. Navigate to: `http://[backend-server-ip]:8000`
3. Optional: Bookmark or add to home screen for app-like experience

### 3. Database Setup
The system uses SQLite database. For the full salon management system:
1. Run the schema SQL: `sqlite3 salon_management.db < database_schema.sql`
2. For inventory extensions, the system will automatically extend the existing `inventory.db`

## Configuration

### Backend Configuration
Edit `backend/main.py` to adjust:
- CORS origins (restrict to salon network in production)
- Upload file size limits
- Analysis confidence thresholds

### API Keys (if using cloud AI services)
Create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your_key_here
# Add other AI service keys as needed
```

## Security Considerations

### Network Security
- Keep backend server on salon's private WiFi network
- Do not expose the backend port to the internet unless necessary
- If exposing to internet, use HTTPS via reverse proxy (NGINX, Caddy, etc.)

### Data Privacy
- Client images are stored temporarily for analysis (can be configured to not store)
- Consider implementing automatic deletion of images after analysis
- Comply with local data protection regulations (GDPR, CCPA, etc.)

### Access Control
- The current implementation is open-access on the local network
- For larger salons, consider adding simple authentication
- Use network segmentation to isolate the recommendation system

## Maintenance

### Updates
- Pull latest changes from repository periodically
- Restart backend after updates: `pkill -f uvicorn && ./start_backend.sh`

### Backups
- Backup the SQLite database regularly: `cp inventory.db inventory.db.backup-$(date +%Y%m%d)`
- Consider automated backup scripts

### Monitoring
- Check backend logs for errors: `tail -f backend.log` (if logging enabled)
- Monitor disk space for image uploads
- Check tablet browser compatibility periodically

## Troubleshooting

### Common Issues

1. **Backend won't start**
   - Check Python version: `python3 --version` (should be 3.8+)
   - Verify dependencies: `pip list`
   - Check port availability: `lsof -i :8000`

2. **Frontend can't connect to backend**
   - Verify backend is running: `curl http://localhost:8000/health`
   - Check network connection between tablet and server
   - Verify backend is bound to 0.0.0.0 (not just localhost)
   - Check firewall settings on server

3. **Image upload fails**
   - Check file permissions on upload directory
   - Verify image format (JPG/PNG only)
   - Check file size limits in backend code

4. **Recommendations seem inaccurate**
   - This is expected with mock analysis functions
   - Replace with actual ML models for production accuracy
   - Adjust lighting and photo quality for better results

## Scaling for Multiple Locations

For salon chains:
1. **Option A**: Centralized backend with each salon connecting to main server
   - Requires reliable internet at each location
   - Centralized data and analytics
   - Single point of failure

2. **Option B**: Local backend at each salon with periodic sync
   - Works with intermittent internet
   - Data privacy maintained per location
   - Requires synchronization mechanism for shared data (client history, etc.)

## Integration with Existing Systems

### Point of Sale
- Link recommendation system to POS via client ID
- Save recommended styles to client profile for future visits

### Inventory Management
- Use product recommendations to suggest retail products
- Track which recommended products are purchased

### Marketing
- Use recommendation data for targeted promotions
- Follow up with clients who received specific recommendations

## Contact and Support
For questions about deployment or customization, refer to the project documentation or contact the system administrator.

---
*Last updated: $(date)*