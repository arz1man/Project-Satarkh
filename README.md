# 🛡️ Project Satharkh: Intelligent Border Video Analytics Platform

<img width="405" height="271" alt="image" src="https://github.com/user-attachments/assets/f5271ef6-4919-40b8-9904-6962a1f3710e" />

**SIH 2026 Submission | Ministry of Home Affairs (MHA) | PS ID: SIH26187**

An autonomous, edge-deployed computer vision platform designed to transform legacy CCTV infrastructure into a real-time, intelligent perimeter defense network. Built for high-reliability threat detection in zero-trust and restricted-bandwidth environments.

## 🚨 The Problem
Conventional border outposts rely on standard IP CCTV cameras requiring continuous human observation. Fatigue and visual overload result in undetected breaches. Proprietary smart-cameras are cost-prohibitive for large-scale remote deployment.

## 💡 The Solution
Project Satharkh acts as a software-defined intelligence layer. It ingests standard RTSP video feeds, webcams, or uploaded footage and utilizes lightweight, high-performance computer vision pipelines to identify, track, and log unauthorized perimeter breaches and anomalies in real-time.

---

<img width="715" height="387" alt="image" src="https://github.com/user-attachments/assets/161d2f84-6c89-4986-bacf-abcfc069c934" />

## ✨ Core Capabilities & Features

### 🧠 Advanced AI Engine (Hardware Accelerated)
* **NVIDIA CUDA Optimization**: Fully hardware-accelerated for RTX GPUs (RTX 4050+), completely eliminating CPU bottlenecks.
* **Persistent Object Tracking**: Utilizes **YOLOv8** combined with **ByteTrack** (`bytetrack.yaml`) for highly accurate, persistent object identification across frames, preventing ID flickering.
* **State-of-the-Art Facial Recognition**: Built on `DeepFace` utilizing the heavy `Facenet512` model and `retinaface` detector. Features strict facial alignment (`align=True`) and enforced detection to eradicate false positives in high-stakes environments. Runs on isolated background threads to guarantee 0 FPS loss on the main video feed.
* **Threat & Anomaly Detection**: Specialized sub-models monitor the feed every few frames to instantly detect **Weapons (Guns/Knives)** and **Violence/Assaults**.

### 🎯 Interactive 3D Geofencing
* **Dynamic Polygonal Tripwires**: Draw complex, multi-point secured perimeters directly over the live video feed.
* **Perspective-Corrected Breaches**: The AI calculates the exact ground-contact point (feet/tires) of tracked targets and checks it against the polygon area, preventing false alarms from heads or arms overlapping the zone on screen.

### 💻 Tactical "Border AI" HUD (Frontend)
* **Sci-Fi Dashboard**: A strictly styled red-and-black tactical interface (React/Tailwind) inspired by military and border defense dashboards.
* **Threat Telemetry Radar**: Dynamically counts and monitors unique targets currently in the sector.
* **Smart Alert Log**: Categorizes events in real-time via WebSockets:
    * `[INFO]`: A new target is acquired in the sector.
    * `[WARNING]`: A known entity is positively identified by the facial recognition database.
    * `[CRITICAL]`: Weapon detected, violence detected, or secure perimeter breached.
* **Global SOS System**: Any critical event automatically triggers a full-screen red pulsing HUD overlay and fires a **Sci-Fi Audio Siren** (via Web Audio API).
* **Live Telemetry**: Real-time CUDA processing FPS is calculated on the backend and streamed to the HUD.
* **Display Toggles**: Instantly switch to B&W Tactical filter and swap between live Webcams and pre-loaded CCTV footage.
* **Admin Security Lock**: The entire control panel is locked behind a passcode (`ADMIN`).

---

## 🛠️ Tech Stack & Architecture

### Backend & AI Pipeline
* **Framework**: FastAPI (Python 3.10+)
* **Vision & AI**: Ultralytics YOLOv8, PyTorch, OpenCV, DeepFace
* **Concurrency**: Thread-safe architecture (`threading.Lock`) allowing asynchronous WebSocket streaming and non-blocking Face/ALPR processing.

### Frontend UI
* **Framework**: Next.js, React, TailwindCSS
* **Communication**: High-frequency WebSockets for zero-latency bounding box rendering and event telemetry.
* **Media**: Direct HTML5 canvas/SVG overlays precisely mapped using `aspect-video` containers to prevent scaling drift on resized displays.

---

## 🤝 Git Workflow & Collaboration
This repository operates on a strict Hub-and-Spoke model for stability during the hackathon.

* **Branching**: All active development (Frontend, API, OpenCV filters) must be pushed to the `dev` branch.
* **Pull Requests**: Do not push directly to `main`.
* **Local GPU Testing**: The Lead AI Engineer will pull `dev` locally, run the heavy GPU inference tests, and merge to `main` upon successful execution.
* **Demo State**: The `main` branch is strictly reserved for the final, stable, offline-capable code used for the live judge demonstration.
