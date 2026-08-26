# 🤖 AI HANDOFF & PROJECT LORE
**For the next AI assistant: Read this carefully before writing any code.**

## 📌 Project Context
- **Name:** Project Satarkh ("Alert/Vigilant" in Hindi)
- **Goal:** Ministry of Home Affairs PS for SIH (Internal College Hackathon). Demo is **Sept 3**.
- **Team Name:** Code Club (inspired by Fight Club)
- **Tech Stack:** 
  - Backend: FastAPI, Python, OpenCV, YOLOv8n, DeepFace (FaceNet), EasyOCR.
  - Frontend: Next.js, React, Tailwind CSS, Lucide icons.

## 🧠 Core Business Logic (DO NOT CHANGE)
We went through multiple iterations to arrive here. Do not revert these decisions:
1. **Universal Alarm:** *Everyone* who crosses the tripwire triggers a breach. Face recognition is for **identification only** (KNOWN vs UNKNOWN). It is NOT an access control whitelist (because printed faces can fake it).
2. **Perspective-Correct Zones:** We do NOT do standard polygon intersection for bounding boxes. We check the **bottom-center ground point** of the bounding box. This ensures a person far down the road doesn't trigger the zone with their head.
3. **16:9 Forced Aspect Ratio:** `video_pipeline.py` forces *all* video inputs (even 4:3 webcams) to exactly `1280x720`. This ensures the 16:9 frontend SVG overlay coordinates always map perfectly 1:1 to the backend pixels without coordinate drift.

## 🏗️ Architecture & Threading
- The main video loop (`get_frame` -> YOLO) runs synchronously and extremely fast.
- **DeepFace and EasyOCR are threaded.** They take a cropped frame, spin up a daemon thread, and write to a dictionary cache (`face_cache`, `plate_cache`). This prevents the video stream from freezing during heavy AI inference.
- **Breach Deduplication:** We track `track_id`s in `self.breach_fired = set()` so a person only triggers the SOS once per session. 
- **Source Switching:** Switching sources (Webcam, DroidCam, Uploaded MP4) calls `ai_engine.reset_tracking()` to wipe caches and prevent stale track IDs from carrying over.

## 🛑 STRICT TECHNICAL QUIRKS (CRITICAL)
- **DeepFace Backend Crash:** The user's Windows environment is missing `haarcascade_frontalface_default.xml`. You **MUST** use `detector_backend="skip"` and `align=False` in `DeepFace.find()`, otherwise the entire backend will crash instantly.
- **FaceNet Only:** We use `model_name="Facenet"`. Do not downgrade to OpenFace (too inaccurate) and do not upgrade to VGG-Face (too large/slow).
- **Webcam on Windows:** Initializing webcam `0` requires `cv2.CAP_DSHOW` and setting the fourcc to `MJPG` to unlock 720p/1080p without extreme lag. See `video_pipeline.py`.

## 🎨 THE "ANTI-VIBE-CODE" DESIGN POLICY
The user has a strict military/tactical terminal aesthetic.
- **Colors:** Background MUST be Slate 900 (`#0f172a`). No exceptions.
- **Borders:** 4px sharp borders. No `rounded-2xl` fluff.
- **Fonts:** JetBrains Mono for data logs, Inter for labels.
- **Vibe:** Dense data, no gradients, no bouncy animations, no purple.
- **Layout:** The app is strictly `h-screen overflow-hidden` (no scrollbars).

## 🚀 How to Run
1. **Backend:** 
   ```bash
   cd backend
   .\venv\Scripts\activate
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
2. **Frontend:** 
   ```bash
   cd frontend
   npm run dev
   ```
*(Frontend runs on localhost:3000)*

## 📝 Where We Left Off
- The universal alarm, face rec threading, plate reading, and source switching (Webcam / DroidCam / MP4) are all 100% working.
- Aspect ratio mapping and perspective-correct zone intersection are 100% working.
- **Next tasks:** 
  1. Adding a "Plate Watchlist" tab to the Access Control section (not built yet).
  2. Final UI layout polishing to ensure everything fits the 1080p screen flawlessly.
