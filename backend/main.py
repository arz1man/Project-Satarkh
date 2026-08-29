import asyncio
import cv2
import os
import time
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Tuple

from core.video_pipeline import VideoPipeline
from core.ai_engine import AIEngine

# Ensure faces dir exists
os.makedirs("registered_faces", exist_ok=True)

app = FastAPI(title="Project Satarkh - Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
video_pipeline = VideoPipeline()  # Auto-detects demo.mp4 if present, else webcam
ai_engine = AIEngine()

active_connections: List[WebSocket] = []

class TripwireConfig(BaseModel):
    points: List[Tuple[int, int]]

class SourceConfig(BaseModel):
    source: str

main_loop = None

@app.on_event("startup")
async def startup_event():
    global main_loop
    main_loop = asyncio.get_running_loop()

@app.get("/")
def read_root():
    return {"status": "Satarkh Backend is running"}

@app.post("/api/tripwire")
def set_tripwire(config: TripwireConfig):
    ai_engine.set_tripwire(config.points)
    return {"status": "success"}

@app.post("/api/nightvision")
def toggle_nightvision(enabled: bool):
    video_pipeline.set_night_vision(enabled)
    return {"status": "success"}

@app.post("/api/source")
def change_source(config: SourceConfig):
    src = int(config.source) if config.source.isdigit() else config.source
    video_pipeline.change_source(src)
    ai_engine.reset_tracking()  # Clear stale track IDs from previous source
    return {"status": "success", "source": src}

@app.get("/api/faces")
def get_faces():
    files = os.listdir("registered_faces")
    return {"faces": files}

@app.post("/api/faces")
async def add_face(file: UploadFile = File(...)):
    path = os.path.join("registered_faces", file.filename)
    with open(path, "wb") as f:
        content = await file.read()
        f.write(content)
    return {"status": "success", "filename": file.filename}

@app.delete("/api/faces/{filename}")
def delete_face(filename: str):
    path = os.path.join("registered_faces", filename)
    if os.path.exists(path):
        os.remove(path)
    return {"status": "success"}

@app.post("/api/upload_video")
async def upload_video(file: UploadFile = File(...)):
    os.makedirs("uploaded_footage", exist_ok=True)
    save_path = os.path.join("uploaded_footage", file.filename)
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)
    # Immediately switch to this footage
    video_pipeline.change_source(save_path)
    return {"status": "success", "path": save_path}

async def broadcast_event(event_data: dict):
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(event_data))
        except:
            active_connections.remove(connection)

def generate_frames():
    while True:
        raw_frame, display_frame = video_pipeline.get_frame()
        if raw_frame is None:
            # If stream is temporarily down (e.g. source switching) or EOF, wait and retry
            time.sleep(0.1)
            continue
            
        # Run AI
        processed_frame, events = ai_engine.process_frame(raw_frame, display_frame)
        
        # Broadcast events
        if events and main_loop:
            for evt in events:
                asyncio.run_coroutine_threadsafe(broadcast_event(evt), main_loop)
        
        # Encode frame as JPEG with high quality
        ret, buffer = cv2.imencode('.jpg', processed_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        frame_bytes = buffer.tobytes()
        
        # Yield for MJPEG stream
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.post("/api/sos")
async def trigger_sos():
    if main_loop:
        asyncio.run_coroutine_threadsafe(broadcast_event({
            "id": "SOS-MANUAL",
            "type": "SOS_TRIGGERED",
            "timestamp": time.time()
        }), main_loop)
    return {"status": "success"}

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    print("Client connected to event stream")
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
