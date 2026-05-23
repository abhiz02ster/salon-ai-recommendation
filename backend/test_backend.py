"""
Test script for the salon AI recommendation backend
"""
from fastapi.testclient import TestClient
from main import app
import io
from PIL import Image
import numpy as np

def create_dummy_image():
    """Create a dummy RGB image for testing"""
    # Create a simple 100x100 RGB image
    img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    img = Image.fromarray(img_array)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

def test_health_endpoint():
    """Test the health endpoint"""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    print("✓ Health endpoint test passed")

def test_root_endpoint():
    """Test the root endpoint"""
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "Salon AI Hair Styling Recommendation API" in data["message"]
    print("✓ Root endpoint test passed")

def test_analyze_endpoint():
    """Test the analyze endpoint with a real test face image"""
    client = TestClient(app)

    # Use a real test image from the directory if it exists, otherwise fall back to dummy
    import os
    test_img_path = "../data/Unknown.jpeg"
    if os.path.exists(test_img_path):
        with open(test_img_path, "rb") as f:
            img_data = f.read()
        img_file = io.BytesIO(img_data)
        filename = "Unknown.jpeg"
        content_type = "image/jpeg"
    elif os.path.exists("test_face3.jpg"):
        with open("test_face3.jpg", "rb") as f:
            img_data = f.read()
        img_file = io.BytesIO(img_data)
        filename = "test_face3.jpg"
        content_type = "image/jpeg"
    else:
        img_file = create_dummy_image()
        filename = "test.png"
        content_type = "image/png"

    # Prepare form data
    data = {
        "height": "170",
        "face_shape": "oval",
        "body_type": "mesomorph",
        "hair_type": "wavy",
        "hair_length": "medium",
        "skin_tone": "medium"
    }

    # Make request
    response = client.post(
        "/analyze",
        files={"file": (filename, img_file, content_type)},
        data=data
    )

    # Check response
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    # Check structure
    assert "recommendations" in data
    assert "analysis_details" in data
    assert "timestamp" in data
    assert isinstance(data["recommendations"], list)
    assert len(data["recommendations"]) > 0

    # Check first recommendation
    rec = data["recommendations"][0]
    assert "style_name" in rec
    assert "description" in rec
    assert "suitability_score" in rec
    assert "reasoning" in rec
    assert "maintenance_tips" in rec
    assert "products_needed" in rec
    
    # Assert video url is present and valid for the highest scoring recommendation
    assert "video_url" in rec
    assert rec["video_url"] is not None
    assert rec["video_url"].startswith("data:video/mp4;base64,")
    
    # Assert ethnicity is analyzed
    details = data["analysis_details"]
    assert "ethnicity_analysis" in details
    assert "detected_ethnicity" in details["ethnicity_analysis"]
    assert "ethnicity" in details["client_attributes"]
    assert details["client_attributes"]["ethnicity"] is not None

    print("✓ Analyze endpoint test passed")
    print(f"  Received {len(data['recommendations'])} recommendations")
    print(f"  Detected Ethnicity: {details['ethnicity_analysis']['detected_ethnicity']} ({details['ethnicity_analysis']['confidence'] * 100}%)")
    print(f"  Top recommendation: {data['recommendations'][0]['style_name']} ({data['recommendations'][0]['suitability_score']}%)")
    print(f"  Generated Runway Video: YES ({len(rec['video_url'])} bytes)")

def run_all_tests():
    """Run all tests"""
    print("Running backend tests...")
    try:
        test_health_endpoint()
        test_root_endpoint()
        test_analyze_endpoint()
        print("\n🎉 All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        raise

if __name__ == "__main__":
    run_all_tests()