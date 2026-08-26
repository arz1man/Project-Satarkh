import asyncio
import cv2
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Tuple

from core.video_pipeline import VideoPipeline
from core.ai_engine import AIEngine

app = FastAPI(title="Project Satark - Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
# For demo, using 0 (webcam). If you have an mp4, change it here.
video_pipeline = VideoPipeline(source=0) 
ai_engine = AIEngine()

# Active WebSocket connections for events
active_connections: List[WebSocket] = []

class TripwireConfig(BaseModel):
    points: List[Tuple[int, int]]

@app.get("/")
def read_root():
    return {"status": "Satark Backend is running"}

@app.post("/api/tripwire")
def set_tripwire(config: TripwireConfig):
    ai_engine.set_tripwire(config.points)
    return {"status": "success", "points": config.points}

@app.post("/api/nightvision")
def toggle_nightvision(enabled: bool):
    video_pipeline.set_night_vision(enabled)
    return {"status": "success", "night_vision": enabled}

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
            break
            
        # Run AI
        processed_frame, events = ai_engine.process_frame(raw_frame, display_frame)
        
        # Broadcast events
        if events:
            # We can't await in a sync generator directly, so we use the event loop
            try:
                loop = asyncio.get_event_loop()
                for evt in events:
                    if loop.is_running():
                        loop.create_task(broadcast_event(evt))
            except RuntimeError:
                pass
        
        # Encode frame as JPEG
        ret, buffer = cv2.imencode('.jpg', processed_frame)
        frame_bytes = buffer.tobytes()
        
        # Yield for MJPEG stream
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

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
