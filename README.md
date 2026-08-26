# Project Satarkh: Intelligent Border Video Analytics Platform

SIH 2026 Submission | Ministry of Home Affairs (MHA) | PS ID: SIH26187

An autonomous, edge-deployed computer vision platform designed to transform legacy CCTV infrastructure into a real-time, intelligent perimeter defense network. Built for high-reliability threat detection in zero-trust and restricted-bandwidth environments.

Problem Statement
Conventional border outposts rely on standard IP CCTV cameras requiring continuous human observation. Fatigue and visual overload result in undetected breaches. Proprietary smart-cameras are cost-prohibitive for large-scale remote deployment.

The Solution: Project Satarkh acts as a software-defined intelligence layer. It ingests standard RTSP video feeds and utilizes lightweight, high-performance object detection models (YOLOv8) to identify, track, and log unauthorized perimeter breaches in real-time.

Core Capabilities
[+] Virtual Geofencing: Dynamic polygonal tripwires mapped directly onto camera feeds.

[+] Kinematic Object Tracking: Differentiates between Person and Vehicle classes to minimize false positives from wildlife or weather.

[+] Autonomous Alerting: Real-time visual and system-level alerts triggered immediately upon boundary breach.

[+] Incident Auditing: Automated snapshot generation and timestamped telemetry logging for post-incident review.

[+] Tactical Vision Mode: Synthetic image enhancement for low-light and high-noise environments.

<img width="715" height="387" alt="image" src="https://github.com/user-attachments/assets/161d2f84-6c89-4986-bacf-abcfc069c934" />


Tech Stack & Requirements
Inference & Backend (Local GPU)
Language: Python 3.10+

Vision AI: Ultralytics YOLOv8, OpenCV

Tracking: DeepSORT / ByteTrack

Hardware Target: NVIDIA RTX 4050 (or higher) with CUDA optimization.

Frontend UI (Anti-Vibe-Coded Standard)
Framework: React + TailwindCSS (or Custom Streamlit)

Design System: Strict Slate/Zinc dark mode (#0f172a). High-contrast typography (Inter + JetBrains Mono). Zero unnecessary animations.

Git Workflow & Collaboration
This repository operates on a strict Hub-and-Spoke model for stability during the hackathon.

Branching: All active development (Frontend, API, OpenCV filters) must be pushed to the dev branch.

Pull Requests: Do not push directly to main.

Local GPU Testing: The Lead AI Engineer will pull dev locally, run the heavy GPU inference tests, and merge to main upon successful execution.

Demo State: The main branch is strictly reserved for the final, stable, offline-capable code used for the live judge demonstration.
