"""
Test script for the new multi-agent, database-backed Salon AI recommendation backend
"""
from fastapi.testclient import TestClient
from main import app
import io
import os
import time
from PIL import Image
import numpy as np

def create_dummy_image():
    """Create a dummy RGB image for testing"""
    img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    img = Image.fromarray(img_array)
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
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

def test_consultation_pipeline():
    """Test the entire multi-agent analyze -> refine -> history pipeline"""
    client = TestClient(app)

    # Use a real test image from the directory if it exists, otherwise fall back to dummy
    test_img_path = "../data/Unknown.jpeg"
    if os.path.exists(test_img_path):
        with open(test_img_path, "rb") as f:
            img_data = f.read()
        img_file1 = io.BytesIO(img_data)
        img_file2 = io.BytesIO(img_data)
        img_file3 = io.BytesIO(img_data)
        filename = "Unknown.jpeg"
        content_type = "image/jpeg"
    elif os.path.exists("test_face3.jpg"):
        with open("test_face3.jpg", "rb") as f:
            img_data = f.read()
        img_file1 = io.BytesIO(img_data)
        img_file2 = io.BytesIO(img_data)
        img_file3 = io.BytesIO(img_data)
        filename = "test_face3.jpg"
        content_type = "image/jpeg"
    else:
        img_file1 = create_dummy_image()
        img_file2 = create_dummy_image()
        img_file3 = create_dummy_image()
        filename = "test.jpg"
        content_type = "image/jpeg"

    # Prepare multipart files
    files = {
        "file_front": (filename, img_file1, content_type),
        "file_left": (filename, img_file2, content_type),
        "file_right": (filename, img_file3, content_type)
    }

    # Height and default walk-in client
    data = {
        "height": "172",
        "client_id": "1"
    }

    print("\n--- Testing POST /analyze (Profiler + Stylist Agents) ---")
    response = client.post("/analyze", files=files, data=data)
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    result = response.json()

    # Check database generated consultation
    assert "consultation_id" in result
    assert result["consultation_id"] is not None
    consultation_id = result["consultation_id"]
    print(f"✓ Created consultation session ID: {consultation_id}")

    # Check recommendations structure
    assert "recommendations" in result
    assert isinstance(result["recommendations"], list)
    assert len(result["recommendations"]) == 3
    
    # Assert video url is present and valid for the highest scoring recommendation
    rec = result["recommendations"][0]
    assert "style_name" in rec
    assert "description" in rec
    assert "suitability_score" in rec
    assert "video_url" in rec
    assert "visualization_url" in rec
    print(f"✓ Top style: {rec['style_name']} ({rec['suitability_score']}% Match)")

    # Assert ethnicity is analyzed
    details = result["analysis_details"]
    assert "ethnicity_analysis" in details
    assert "detected_ethnicity" in details["ethnicity_analysis"]
    print(f"✓ Detected Ethnicity: {details['ethnicity_analysis']['detected_ethnicity']}")

    # Test GET /history
    print("\n--- Testing GET /history ---")
    history_response = client.get("/history")
    assert history_response.status_code == 200
    history_data = history_response.json()
    assert "history" in history_data
    assert len(history_data["history"]) > 0
    print(f"✓ History records retrieved: {len(history_data['history'])} records found")

    # Test POST /refine (Refinement prompt)
    print("\n--- Sleeping 20 seconds to prevent rate limits before refinement ---")
    time.sleep(20)
    print("\n--- Testing POST /refine (Stylist Refinement) ---")
    refine_payload = {
        "consultation_id": consultation_id,
        "feedback": "Make the hair style slightly shorter on the sides and back"
    }
    refine_response = client.post("/refine", json=refine_payload)
    assert refine_response.status_code == 200, f"Refine failed: {refine_response.text}"
    refine_result = refine_response.json()
    
    assert "recommendations" in refine_result
    assert len(refine_result["recommendations"]) == 3
    ref_rec = refine_result["recommendations"][0]
    print(f"✓ Refinement successful! New Top Recommendation: {ref_rec['style_name']}")

    print("✓ Full consultation pipeline test passed successfully!")


def run_all_tests():
    """Run all tests"""
    print("Starting Salon AI Multi-Agent validation...")
    try:
        test_health_endpoint()
        test_root_endpoint()
        test_consultation_pipeline()
        print("\n🎉 All tests passed successfully!")
    except Exception as e:
        print(f"\n❌ Validation test failed: {e}")
        raise

if __name__ == "__main__":
    run_all_tests()