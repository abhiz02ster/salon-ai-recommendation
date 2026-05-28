#!/usr/bin/env python3
"""
Salon AI Recommendation System - Automated Functional Test Suite
Validates all backend API endpoints, CRM database, and stylist workflows.
"""

import sys
import os
import unittest
import urllib.request
import urllib.error
import urllib.parse
import json
import time

class APIClient:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url

    def request(self, method, path, data=None, files=None):
        url = f"{self.base_url}{path}"
        headers = {}
        body = None

        if data is not None:
            if isinstance(data, dict):
                body = json.dumps(data).encode('utf-8')
                headers['Content-Type'] = 'application/json'
            else:
                body = data
        elif files is not None:
            boundary = '----BoundaryTesting12345'
            headers['Content-Type'] = f'multipart/form-data; boundary={boundary}'
            body_parts = []
            
            # Simple form fields
            if isinstance(files, dict):
                for name, value in files.items():
                    if isinstance(value, tuple):
                        filename, file_bytes = value
                        body_parts.append(f'--{boundary}\r\n'.encode('utf-8'))
                        body_parts.append(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode('utf-8'))
                        body_parts.append(b'Content-Type: image/jpeg\r\n\r\n')
                        body_parts.append(file_bytes)
                        body_parts.append(b'\r\n')
                    else:
                        body_parts.append(f'--{boundary}\r\n'.encode('utf-8'))
                        body_parts.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode('utf-8'))
                        body_parts.append(str(value).encode('utf-8'))
                        body_parts.append(b'\r\n')
                        
            body_parts.append(f'--{boundary}--\r\n'.encode('utf-8'))
            body = b''.join(body_parts)

        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as res:
                response_body = res.read().decode('utf-8')
                return res.status, json.loads(response_body) if response_body else {}
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode('utf-8')
                err_data = json.loads(err_body)
            except Exception:
                err_data = err_body
            return e.code, err_data
        except Exception as e:
            return 500, {"detail": str(e)}

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, data=None, files=None):
        return self.request("POST", path, data=data, files=files)

    def put(self, path, data=None):
        return self.request("PUT", path, data=data)


class TestSalonAIWorkflows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = APIClient()
        # Verify server is reachable before starting
        status, _ = cls.client.get("/health")
        if status != 200:
            print("❌ ERROR: Backend server is not running on http://localhost:8000")
            print("Please start the backend server first using:")
            print("  python main.py")
            sys.exit(1)
        else:
            print("✓ Live backend connection established on http://localhost:8000")

    def test_01_health_check(self):
        """Validate health check endpoint"""
        status, data = self.client.get("/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "healthy")

    def test_02_client_checkin_and_profile_workflows(self):
        """Validate client check-in, search, profile details update, and stylist notes"""
        # 1. Check in client
        phone = f"99{int(time.time()) % 100000000}" # Unique number
        checkin_payload = {
            "first_name": "Alice",
            "last_name": "Test",
            "phone": phone
        }
        status, data = self.client.post("/check-in", checkin_payload)
        self.assertEqual(status, 200)
        self.assertIn("client_id", data)
        client_id = data["client_id"]
        self.assertEqual(data["first_name"], "Alice")
        
        # 2. Search profile by phone
        status, search_data = self.client.get(f"/api/crm/clients/search-by-phone?phone={phone}")
        self.assertEqual(status, 200)
        self.assertTrue(search_data.get("found"))
        self.assertTrue(len(search_data.get("clients", [])) > 0)
        
        # 3. Retrieve default CRM Profile
        status, profile = self.client.get(f"/api/crm/clients/{client_id}/profile")
        self.assertEqual(status, 200)
        self.assertEqual(profile.get("first_name"), "Alice")

        # 4. Save updates to Client profile drawer fields
        update_payload = {
            "hair_density": "thin",
            "hair_porosity": "high",
            "natural_color": "Platinum Blonde",
            "scalp_type": "sensitive",
            "allergies": "Ammonia and lavender oils",
            "chemical_treatment_history": "Bleached 3 times last month"
        }
        status, update_res = self.client.put(f"/api/crm/clients/{client_id}/profile", update_payload)
        self.assertEqual(status, 200)

        # 5. Verify updates were committed
        status, updated_profile = self.client.get(f"/api/crm/clients/{client_id}/profile")
        self.assertEqual(status, 200)
        self.assertEqual(updated_profile.get("hair_density"), "thin")
        self.assertEqual(updated_profile.get("natural_color"), "Platinum Blonde")
        self.assertEqual(updated_profile.get("allergies"), "Ammonia and lavender oils")

        # 6. Post Stylist consultation notes
        note_payload = {
            "content": "Prefers cool tone formulas only. Scalp burns easily.",
            "note_type": "formula",
            "staff_id": 1
        }
        status, note_res = self.client.post(f"/api/crm/clients/{client_id}/notes", note_payload)
        self.assertEqual(status, 200)

        # 7. Read notes timeline
        status, notes_timeline = self.client.get(f"/api/crm/clients/{client_id}/notes")
        self.assertEqual(status, 200)
        self.assertTrue(len(notes_timeline.get("notes", [])) > 0)
        self.assertEqual(notes_timeline["notes"][0]["content"], "Prefers cool tone formulas only. Scalp burns easily.")

    def test_03_ai_recommendations_and_refinement(self):
        """Validate AI portrait profiling analysis and hair profile drawer updates"""
        # Create a dummy client first
        phone = f"98{int(time.time()) % 100000000}"
        _, checkin_data = self.client.post("/check-in", {"first_name": "Bob", "last_name": "Test", "phone": phone})
        client_id = checkin_data["client_id"]

        # Find a valid face portrait JPEG from local files to avoid CV2 imdecode errors
        valid_photo_bytes = None
        photo_dir = "data/photos"
        if os.path.exists(photo_dir):
            photos = [f for f in os.listdir(photo_dir) if f.startswith("client_front_") and f.endswith(".jpg")]
            for p in photos:
                path = os.path.join(photo_dir, p)
                if os.path.getsize(path) > 1000:
                    try:
                        with open(path, "rb") as f:
                            valid_photo_bytes = f.read()
                        break
                    except Exception:
                        pass
                        
        # Fallback to minimal JPEG if none found
        if not valid_photo_bytes:
            valid_photo_bytes = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x0b\x00\xff\xda\x00\x08\x01\x01\x00\x00?\x00\x37\xff\xd9'

        files_payload = {
            "file_front": ("front.jpg", valid_photo_bytes),
            "client_id": client_id
        }
        status, analyze_res = self.client.post("/analyze", files=files_payload)
        self.assertEqual(status, 200)
        self.assertIn("consultation_id", analyze_res)
        self.assertIn("recommendations", analyze_res)
        consultation_id = analyze_res["consultation_id"]

        # 2. Refine suggestions based on stylist feedback
        refine_payload = {
            "consultation_id": consultation_id,
            "feedback": "Make the fringe shorter and texture more modern"
        }
        status, refine_res = self.client.post("/refine", refine_payload)
        self.assertEqual(status, 200)
        self.assertIn("recommendations", refine_res)

        # 3. Retrieve client history and ensure consultation is recorded
        status, history_res = self.client.get(f"/history?client_id={client_id}")
        self.assertEqual(status, 200)
        self.assertTrue(len(history_res.get("history", [])) > 0)
        self.assertEqual(history_res["history"][0]["id"], consultation_id)

    def test_04_staff_workload_and_appointment_booking(self):
        """Validate staff profiles, scheduling preview, booking checkout, and workload revenue metrics"""
        # 1. Retrieve current staff list
        status, staff_data = self.client.get("/api/staff")
        self.assertEqual(status, 200)
        initial_staff_count = len(staff_data.get("staff", []))

        # 2. Register a new Stylist with a unique name to avoid collision with previous test runs
        unique_suffix = int(time.time())
        new_staff = {
            "first_name": f"Stylist_{unique_suffix}",
            "last_name": "TestLastName",
            "specialty": "Balayage Artist"
        }
        status, register_res = self.client.post("/api/staff", new_staff)
        self.assertEqual(status, 200)
        self.assertIn("stylist_passcode", register_res)
        self.assertIn("admin_passcode", register_res)
        self.assertEqual(len(register_res["stylist_passcode"]), 6)
        self.assertEqual(len(register_res["admin_passcode"]), 6)

        # 3. Verify registration
        status, updated_staff_data = self.client.get("/api/staff")
        self.assertEqual(status, 200)
        staff_list = updated_staff_data.get("staff", [])
        self.assertEqual(len(staff_list), initial_staff_count + 1)
        
        # Locate target stylist ID
        target_stylist = next((s for s in staff_list if s["first_name"] == f"Stylist_{unique_suffix}"), None)
        self.assertIsNotNone(target_stylist)
        stylist_id = target_stylist["id"]

        # 4. Check initial workload metrics (should be empty)
        status, initial_metrics = self.client.get(f"/api/staff/metrics?staff_id={stylist_id}")
        self.assertEqual(status, 200)
        self.assertEqual(initial_metrics.get("total_appointments"), 0)
        self.assertEqual(initial_metrics.get("total_revenue"), 0)

        # 5. Book appointment (Checkout) under this stylist
        phone = f"97{int(time.time()) % 100000000}"
        _, checkin_data = self.client.post("/check-in", {"first_name": "Charlie", "last_name": "Test", "phone": phone})
        client_id = checkin_data["client_id"]

        booking_payload = {
            "client_id": client_id,
            "appointment_date": "2026-06-01T14:30:00",
            "consultation_id": 0,
            "total_amount": 2500.00,
            "payment_method": "upi",
            "staff_id": stylist_id
        }
        status, booking_res = self.client.post("/api/crm/appointments", booking_payload)
        self.assertEqual(status, 200)
        self.assertIn("appointment_id", booking_res)
        appointment_id = booking_res["appointment_id"]

        # 6. Verify workload metrics updated successfully
        status, updated_metrics = self.client.get(f"/api/staff/metrics?staff_id={stylist_id}")
        self.assertEqual(status, 200)
        self.assertEqual(updated_metrics.get("total_appointments"), 1)
        self.assertEqual(updated_metrics.get("total_revenue"), 2500.00)
        self.assertTrue(len(updated_metrics.get("appointments", [])) > 0)
        self.assertEqual(updated_metrics["appointments"][0]["id"], appointment_id)

    def test_05_feedback_whatsapp_billing_and_marketing(self):
        """Validate feedback reviews, whatsapp invoices, branding overrides, and promotion broadcaster"""
        # 1. Book an appointment first
        phone = f"96{int(time.time()) % 100000000}"
        _, checkin_data = self.client.post("/check-in", {"first_name": "Dev", "last_name": "Test", "phone": phone})
        client_id = checkin_data["client_id"]
        
        _, booking_res = self.client.post("/api/crm/appointments", {
            "client_id": client_id,
            "appointment_date": "2026-06-02T10:00:00",
            "consultation_id": 0,
            "total_amount": 1800.00,
            "payment_method": "card"
        })
        appt_id = booking_res["appointment_id"]

        # 2. Submit feedback & trigger WhatsApp billing invoice
        feedback_payload = {
            "satisfaction_score": 5,
            "notes": "Absolutely stunning haircut. Very professional!"
        }
        status, feedback_res = self.client.post(f"/api/crm/appointments/{appt_id}/feedback", feedback_payload)
        self.assertEqual(status, 200)
        self.assertTrue(feedback_res.get("success"))

        # 3. Test Local Configuration overrides (Branding name and UI styling theme)
        config_payload = {
            "salon_name": "Phoenix Luxury Styling Salon",
            "active_theme": "theme-rose-champagne"
        }
        status, config_res = self.client.post("/api/config", config_payload)
        self.assertEqual(status, 200)

        # 4. Verify branding overrides persisted
        status, active_config = self.client.get("/api/config")
        self.assertEqual(status, 200)
        self.assertEqual(active_config.get("salon_name"), "Phoenix Luxury Styling Salon")
        self.assertEqual(active_config.get("active_theme"), "theme-rose-champagne")

        # 5. Launch promotion marketing campaign
        campaign_payload = {
            "message_content": "Dear {name}, enjoy 20% off color services at {salon_name}! Book at {booking_url}",
            "filter_type": "all",
            "filter_value": None
        }
        status, campaign_res = self.client.post("/api/promotions/run", campaign_payload)
        self.assertEqual(status, 200)
        self.assertIn("recipients_count", campaign_res)
        self.assertIn("messages_sent", campaign_res)

    def test_06_passcode_authentication(self):
        """Validate passcode login verification checks"""
        # 1. Test Super Admin owner passcode login
        status, data = self.client.post("/api/auth/login", {"role": "super-admin", "passcode": "owner123"})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        
        # Test incorrect passcode
        status, data = self.client.post("/api/auth/login", {"role": "super-admin", "passcode": "wrong_pass"})
        self.assertEqual(status, 401)
        
        # 2. Test Admin Portal login with system administrator override (admin123)
        status, data = self.client.post("/api/auth/login", {"role": "admin", "passcode": "admin123"})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        
        # 3. Test Stylist login (Priya / Rahul seeded staff)
        # Priya has stylist_passcode '111111'
        status, data = self.client.post("/api/auth/login", {"role": "stylist", "staff_id": 1, "passcode": "111111"})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("staff", {}).get("id"), 1)
        
        # Test incorrect passcode for Priya
        status, data = self.client.post("/api/auth/login", {"role": "stylist", "staff_id": 1, "passcode": "wrong_code"})
        self.assertEqual(status, 401)
        
        # 4. Test Admin login using Priya's admin_passcode ('222222')
        status, data = self.client.post("/api/auth/login", {"role": "admin", "staff_id": 1, "passcode": "222222"})
        self.assertEqual(status, 200)
        self.assertTrue(data.get("success"))
        
        # 5. Test get active services list
        status, data = self.client.get("/api/services")
        self.assertEqual(status, 200)
        self.assertTrue(len(data.get("services", [])) > 0)


if __name__ == "__main__":
    print("======================================================================")
    print("        SALON AI RECOMMENDATION SYSTEM - AUTOMATED INTEGRATION TESTS  ")
    print("======================================================================")
    unittest.main()
