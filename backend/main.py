from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import cv2
import json

app = FastAPI(title="Project Satark - Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Satark Backend is running"}

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to video stream")
    try:
        while True:
            # Placeholder for video frame streaming
            # Real implementation will grab frames from video_pipeline
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("Client disconnected")

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to event stream")
    try:
        while True:
            # Placeholder for event stream (breaches, recognized faces, etc)
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
