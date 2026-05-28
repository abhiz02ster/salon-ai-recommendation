#!/usr/bin/env python3
"""
Salon AI Recommendation System - E2E System Validation & Test Automation Runner.
Completely validates frontend compilation, local SQLite states, API endpoints, and workflows.
"""

import os
import sys
import subprocess
import time
import urllib.request
import urllib.error

# Setup colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def print_section(title):
    print(f"\n{BOLD}{CYAN}======================================================================{RESET}")
    print(f"{BOLD}{CYAN}   {title.upper()}{RESET}")
    print(f"{BOLD}{CYAN}======================================================================{RESET}\n")

def run_command(command, cwd=None, env=None):
    """Run a shell command and return stdout/stderr and success status."""
    print(f"Executing: {' '.join(command)} (cwd: {cwd or '.'})")
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        return False, "", str(e)

def is_backend_running(url="http://localhost:8000/health"):
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.status == 200
    except Exception:
        return False

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")
    backend_dir = os.path.join(root_dir, "backend")
    
    # Track overall success
    success = True
    
    # 1. Validate Frontend Build Compilation
    print_section("Step 1: Frontend Build Compilation")
    print("Compiling React frontend bundle to verify zero compiler/bundler errors...")
    build_ok, stdout, stderr = run_command(["npm", "run", "build"], cwd=frontend_dir)
    if build_ok:
        print(f"{GREEN}✓ Frontend compilation successful (Vite build passed cleanly).{RESET}")
    else:
        print(f"{RED}❌ Frontend compilation failed!{RESET}")
        print(f"{YELLOW}Standard Output:{RESET}\n{stdout}")
        print(f"{RED}Standard Error:{RESET}\n{stderr}")
        success = False
        
    # 2. Check Backend Server and Launch if not running
    print_section("Step 2: Backend Server Verification")
    backend_started_by_us = False
    backend_process = None
    
    if is_backend_running():
        print(f"{GREEN}✓ Backend server is already running on http://localhost:8000.{RESET}")
    else:
        print(f"{YELLOW}⚠ Backend server is not running. Starting temporary backend server...{RESET}")
        # Resolve backend python path from venv
        venv_python = os.path.join(backend_dir, "venv", "bin", "python")
        if not os.path.exists(venv_python):
            # Fallback to system python if venv not found
            venv_python = "python3"
            
        try:
            # Run uvicorn server in background
            env = os.environ.copy()
            # Enforce MOCK_MEDIA to be true for validation run to save credentials/credits
            env["MOCK_MEDIA"] = "true"
            
            backend_process = subprocess.Popen(
                [venv_python, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
                cwd=backend_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env
            )
            backend_started_by_us = True
            
            # Wait for server to become healthy
            print("Waiting for backend server to initialize...")
            for i in range(15):
                time.sleep(1.0)
                if is_backend_running():
                    print(f"{GREEN}✓ Temporary backend server initialized successfully on http://localhost:8000.{RESET}")
                    break
            else:
                print(f"{RED}❌ Failed to start backend server within 15 seconds!{RESET}")
                # Check process return code or error output
                if backend_process.poll() is not None:
                    out, err = backend_process.communicate()
                    print(f"{RED}Uvicorn failed to start:{RESET}\n{err or out}")
                success = False
        except Exception as e:
            print(f"{RED}❌ Exception occurred while starting backend: {e}{RESET}")
            success = False
            
    # 3. Execute Integration Test Suite
    if success:
        print_section("Step 3: Backend Workflow Functional Tests")
        print("Running python integration test suite to validate database, APIs, and client-stylist flows...")
        
        venv_python = os.path.join(backend_dir, "venv", "bin", "python")
        if not os.path.exists(venv_python):
            venv_python = "python3"
            
        test_ok, stdout, stderr = run_command([venv_python, "run_tests.py"], cwd=backend_dir)
        if test_ok:
            print(f"{GREEN}✓ All integration tests completed successfully!{RESET}")
            print(stdout)
        else:
            print(f"{RED}❌ Integration tests failed!{RESET}")
            print(f"{YELLOW}Test Output:{RESET}\n{stdout}")
            print(f"{RED}Test Error:{RESET}\n{stderr}")
            success = False
            
    # 4. Clean up Backend Server
    if backend_started_by_us and backend_process:
        print_section("Step 4: Cleanup")
        print("Stopping temporary backend server process...")
        try:
            backend_process.terminate()
            backend_process.wait(timeout=5)
            print(f"{GREEN}✓ Temporary backend server stopped gracefully.{RESET}")
        except subprocess.TimeoutExpired:
            print(f"{YELLOW}⚠ Server did not terminate gracefully, forcing kill...{RESET}")
            backend_process.kill()
            print(f"{GREEN}✓ Temporary backend server killed.{RESET}")
        except Exception as e:
            print(f"{RED}⚠ Error while stopping backend server: {e}{RESET}")

    # 5. Final Report
    print_section("Validation Report")
    if success:
        print(f"{BOLD}{GREEN}✓ SUCCESS: All system workflows and frontend compilations are fully functional!{RESET}")
        sys.exit(0)
    else:
        print(f"{BOLD}{RED}❌ FAILURE: System validation failed. Please review errors above.{RESET}")
        sys.exit(1)

if __name__ == "__main__":
    main()
