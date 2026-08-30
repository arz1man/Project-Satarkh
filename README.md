#  Project Satarkh: Intelligent Border Video Analytics Platform

       <img width="282" height="283" alt="image" src="https://github.com/user-attachments/assets/cba8e9df-7dd7-4993-995e-b4df154e988c" />


**SIH 2026 Submission | Ministry of Home Affairs (MHA) | PS ID: SIH26187**

An autonomous, edge-deployed computer vision platform designed to transform legacy CCTV infrastructure into a real-time, intelligent perimeter defense network. Built for high-reliability threat detection in zero-trust and restricted-bandwidth environments.

---

<img width="715" height="387" alt="image" src="https://github.com/user-attachments/assets/161d2f84-6c89-4986-bacf-abcfc069c934" />

## ✨ Key AI Modules & Features

### ⚔️ Real-Time Weapon Detection
* Integrates a dedicated computer vision model to scan frames for firearms, knives, and other lethal weapons.
* Instantly triggers a **CRITICAL** alert, firing a global SOS visual and audio siren on the dashboard the moment a weapon is unholstered or visible in the camera feed.

### 👤 High-Accuracy Facial Recognition
* Built on **DeepFace** utilizing the heavy **Facenet512** model and **retinaface** detector backend.
* Features strict facial alignment (\lign=True\) and enforced detection parameters to completely eradicate false positives in high-stakes environments.
* Matches identities against a known database and triggers **WARNING** alerts for flagged individuals.
* Fully threaded: runs on isolated background queues to guarantee **0 FPS loss** on the main surveillance video feed.

### 🚨 Violence & Anomaly Detection
* Analyzes kinematic motion and subject interaction to detect assaults, brawls, or erratic mob behavior.
* Operates in tandem with standard tracking to instantly flag hostile actions even if weapons are not immediately visible.

### 🎯 Interactive 3D Geofencing (Tripwire)
* **Dynamic Polygonal Tripwires**: Draw complex, multi-point secured perimeters directly over the live video feed.
* **Perspective-Corrected Breaches**: The AI precisely calculates the exact ground-contact point (feet/tires) of tracked targets and checks it against the polygon area. This completely prevents false alarms caused by a person's head or arms overlapping the zone on screen.

### 💻 Tactical "Border AI" HUD (Frontend)
* **Sci-Fi Dashboard**: A strictly styled red-and-black tactical interface (React/Tailwind) inspired by military and border defense dashboards.
* **Threat Telemetry Radar**: Dynamically counts and monitors unique targets currently in the sector.
* **Smart Alert Log**: Categorizes events in real-time via WebSockets (\INFO\, \WARNING\, \CRITICAL\).
* **Live Telemetry**: Real-time CUDA processing FPS is calculated on the backend and streamed to the HUD.

---

## 🛠️ Tech Stack & Architecture

### Backend & AI Pipeline
* **Framework**: FastAPI (Python 3.10+)
* **Vision & AI**: Ultralytics YOLOv8 (Tracking + Weapons + Violence), DeepFace (Facial Recognition), OpenCV
* **Hardware**: Fully hardware-accelerated for NVIDIA RTX GPUs (CUDA 12.1), completely eliminating CPU bottlenecks.
* **Concurrency**: Thread-safe architecture (\	hreading.Lock\) allowing asynchronous WebSocket streaming and non-blocking Face/ALPR processing.

### Frontend UI
* **Framework**: Next.js, React, TailwindCSS
* **Communication**: High-frequency WebSockets for zero-latency bounding box rendering and event telemetry.

---

## 🤝 Git Workflow & Collaboration
This repository operates on a strict Hub-and-Spoke model for stability during the hackathon.

* **Branching**: All active development (Frontend, API, OpenCV filters) must be pushed to the \dev\ branch.
* **Pull Requests**: Do not push directly to \main\.
* **Demo State**: The \main\ branch is strictly reserved for the final, stable, offline-capable code used for the live judge demonstration.
