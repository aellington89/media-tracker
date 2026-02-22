#!/usr/bin/env python3
"""
Media Tracker — Entry Point
Starts the FastAPI server and opens the system browser.

Usage:
    python run.py [--port 8765] [--no-browser]
"""
import argparse
import sys
import time
import threading
import webbrowser
import urllib.request
import urllib.error

import uvicorn

HOST = "127.0.0.1"
DEFAULT_PORT = 8765


def wait_for_server(url: str, timeout: int = 15) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return True
        except Exception:
            time.sleep(0.3)
    return False


def run_server(port: int):
    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=port,
        log_level="warning",
        reload=False,
    )


def main():
    parser = argparse.ArgumentParser(description="Media Tracker")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on")
    parser.add_argument("--no-browser", action="store_true", help="Don't open the browser")
    args = parser.parse_args()

    url = f"http://{HOST}:{args.port}"
    print(f"Starting Media Tracker at {url}")

    thread = threading.Thread(target=run_server, args=(args.port,), daemon=True)
    thread.start()

    if not args.no_browser:
        health_url = f"{url}/api/stats/overview"
        print("Waiting for server to start...")
        if wait_for_server(health_url):
            print("Opening browser...")
            webbrowser.open(url)
        else:
            print(f"Server took too long to start. Open {url} manually.")

    print("Press Ctrl+C to stop.")
    try:
        thread.join()
    except KeyboardInterrupt:
        print("\nMedia Tracker stopped.")
        sys.exit(0)


if __name__ == "__main__":
    main()
