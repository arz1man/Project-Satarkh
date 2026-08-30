import cv2
import numpy as np
import threading
import queue
import time
import os
from shapely.geometry import Point, Polygon, LineString
from ultralytics import YOLO
import easyocr
from deepface import DeepFace

class AIEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.model = YOLO('yolov8n.pt')
        
        self.weapon_model = None
        self.violence_model = None
        if os.path.exists('weights/weapon_detection.pt'):
            self.weapon_model = YOLO('weights/weapon_detection.pt')
        if os.path.exists('weights/violence_detection.pt'):
            self.violence_model = YOLO('weights/violence_detection.pt')
            
        self.frame_count = 0
        self.reader = easyocr.Reader(['en'], gpu=True)
        self.tripwire_points = []
        self.tripwire_polygon = None
        self.target_classes = [0, 2, 3, 5, 7]
        self.face_cache = {}
        self.plate_cache = {}
        self.breach_fired = set()
        self.seen_tracks = set()

        # Thread Queue Exhaustion Fix: LIFO queues to drop stale frames if overloaded
        self.face_queue = queue.LifoQueue(maxsize=2)
        self.plate_queue = queue.LifoQueue(maxsize=2)
        
        self.last_fps_time = time.time()
        self.frame_count_for_fps = 0
        self.current_fps = 0.0

        # Start background workers
        threading.Thread(target=self._face_worker, daemon=True).start()
        threading.Thread(target=self._plate_worker, daemon=True).start()

    def reset_tracking(self):
        """Call this whenever the video source changes to clear all stale track state."""
        self.face_cache = {}
        self.plate_cache = {}
        self.breach_fired = set()
        self.seen_tracks = set()
        # Reinitialize YOLO model to clear its internal tracker state
        self.model = YOLO('yolov8n.pt')
        print("AI Engine: tracking state reset.")

    def set_tripwire(self, points):
        self.tripwire_points = points
        self.breach_fired = set()  # Reset on new zone
        if len(points) >= 3:
            self.tripwire_polygon = Polygon(points)
            if not self.tripwire_polygon.is_valid:
                self.tripwire_polygon = self.tripwire_polygon.convex_hull
        elif len(points) == 2:
            self.tripwire_polygon = LineString(points)
        else:
            self.tripwire_polygon = None

    def _check_breach(self, bbox, frame_shape):
        """
        Checks if the object's ground contact point (bottom-center of bbox)
        is inside the virtual tripwire zone. Using bottom-center is perspective-correct
        since it represents where the person/vehicle actually touches the ground.
        """
        if not self.tripwire_polygon:
            return False

        x1, y1, x2, y2 = bbox
        h, w = frame_shape[:2]

        # Scale to the 1280x720 coordinate system used by the frontend SVG
        scale_x = 1280.0 / w
        scale_y = 720.0 / h

        # Bottom-center = ground contact point (perspective-correct)
        foot_x = ((x1 + x2) / 2) * scale_x
        foot_y = y2 * scale_y

        ground_point = Point(foot_x, foot_y)
        # Create a small bounding box/circle around the feet to ensure it triggers 
        # even if it barely touches the line or skips past it fast.
        feet_area = ground_point.buffer(15.0) 

        if isinstance(self.tripwire_polygon, Polygon):
            return self.tripwire_polygon.intersects(feet_area)
        elif isinstance(self.tripwire_polygon, LineString):
            return self.tripwire_polygon.intersects(feet_area)
        return False

    def _plate_worker(self):
        while True:
            try:
                frame, bbox, track_id = self.plate_queue.get()
                x1, y1, x2, y2 = bbox
                cropped = frame[int(y1):int(y2), int(x1):int(x2)]
                if cropped.size > 0:
                    results = self.reader.readtext(cropped)
                    if results:
                        best = max(results, key=lambda r: r[2])
                        if best[2] > 0.3:
                            self.plate_cache[track_id] = best[1].upper().strip()
            except Exception as e:
                print("ALPR Worker Error:", e)

    def _extract_license_plate(self, frame, bbox, track_id):
        if track_id not in self.plate_cache:
            self.plate_cache[track_id] = None  # Mark as in-progress
            try:
                self.plate_queue.put_nowait((frame.copy(), bbox, track_id))
            except queue.Full:
                pass  # Drop frame if overloaded
        return self.plate_cache.get(track_id)

    def _face_worker(self):
        while True:
            try:
                frame, bbox, track_id = self.face_queue.get()
                x1, y1, x2, y2 = bbox
                cropped = frame[int(y1):int(y2), int(x1):int(x2)]
                
                if cropped.size == 0 or not os.path.exists("registered_faces") or not any(f.lower().endswith(('.png', '.jpg', '.jpeg')) for f in os.listdir("registered_faces")):
                    self.face_cache[track_id] = "UNKNOWN"
                    continue
                    
                dfs = DeepFace.find(
                    img_path=cropped,
                    db_path="registered_faces",
                    detector_backend="retinaface",
                    align=True,
                    model_name="Facenet512",
                    enforce_detection=True,
                    silent=True
                )
                if len(dfs) > 0 and not dfs[0].empty:
                    match_path = dfs[0].iloc[0]['identity']
                    name = os.path.basename(match_path).split('.')[0]
                    self.face_cache[track_id] = f"KNOWN:{name}"
                else:
                    self.face_cache[track_id] = "UNKNOWN"
            except Exception as e:
                self.face_cache[track_id] = "UNKNOWN"
                print("Face Rec Worker Error:", e)

    def process_frame(self, raw_frame, display_frame):
        events = []
        
        # Calculate FPS
        self.frame_count_for_fps += 1
        current_time = time.time()
        elapsed = current_time - self.last_fps_time
        if elapsed >= 1.0:
            self.current_fps = self.frame_count_for_fps / elapsed
            events.append({"type": "TELEMETRY", "fps": round(self.current_fps, 1)})
            self.last_fps_time = current_time
            self.frame_count_for_fps = 0

        with self.lock:
            results = self.model.track(raw_frame, persist=True, tracker="bytetrack.yaml", classes=self.target_classes, verbose=False)

        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            class_ids = results[0].boxes.cls.int().cpu().tolist()
            class_names = {0: "PERSON", 2: "CAR", 3: "MOTORCYCLE", 5: "BUS", 7: "TRUCK"}

            for box, track_id, class_id in zip(boxes, track_ids, class_ids):
                x1, y1, x2, y2 = map(int, box)
                is_breaching = self._check_breach((x1, y1, x2, y2), raw_frame.shape)

                # --- FACE RECOGNITION (persons only, threaded) ---
                face_status = None
                if class_id == 0:
                    if track_id not in self.face_cache:
                        self.face_cache[track_id] = "SCANNING"
                        try:
                            self.face_queue.put_nowait((raw_frame.copy(), box, track_id))
                        except queue.Full:
                            pass
                    face_status = self.face_cache.get(track_id, "SCANNING")

                # --- LICENSE PLATE (vehicles only, always try to read) ---
                plate = None
                if class_id != 0:
                    plate = self._extract_license_plate(raw_frame, box, track_id)

                # --- BOUNDING BOX COLOR ---
                # Red = breaching, Yellow = known person, Green = normal
                if is_breaching:
                    color = (0, 0, 255)   # Red
                elif face_status and face_status.startswith("KNOWN"):
                    color = (0, 255, 255) # Yellow
                else:
                    color = (255, 255, 0) # Jarvis Cyan (BGR)

                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)

                # --- LABEL ---
                obj_name = class_names.get(class_id, "OBJECT")
                if face_status and face_status.startswith("KNOWN:"):
                    name = face_status.split("KNOWN:")[1]
                    label = f"{name} [KNOWN]"
                elif face_status == "SCANNING":
                    label = f"ID:{track_id} [SCANNING]"
                elif face_status == "UNKNOWN":
                    label = f"ID:{track_id} [UNKNOWN]"
                else:
                    label = f"{obj_name} #{track_id}"

                if plate:
                    label += f" | {plate}"

                cv2.putText(display_frame, label, (x1, max(y1 - 10, 15)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

                # Draw ground contact dot (perspective-correct point used for zone detection)
                foot_x = (x1 + x2) // 2
                foot_y = y2
                dot_color = (0, 0, 255) if is_breaching else (0, 255, 0)
                cv2.circle(display_frame, (foot_x, foot_y), 5, dot_color, -1)
                cv2.circle(display_frame, (foot_x, foot_y), 8, (255, 255, 255), 1)

                # --- BREACH EVENTS ---
                if is_breaching:
                    if track_id not in self.breach_fired:
                        self.breach_fired.add(track_id)
                        event = {
                            "id": f"T-{track_id}",
                            "type": "PERSON_BREACH" if class_id == 0 else "VEHICLE_BREACH",
                            "obj_class": obj_name,
                            "timestamp": time.time(),
                        }
                        if face_status and face_status.startswith("KNOWN:"):
                            event["face"] = face_status.split("KNOWN:")[1]
                            event["identity"] = "KNOWN"
                        elif face_status == "UNKNOWN":
                            event["identity"] = "UNKNOWN INTRUDER"
                        else:
                            event["identity"] = "IDENTIFYING..."
                        if plate:
                            event["plate"] = plate
                        events.append(event)
                else:
                    if track_id in self.breach_fired:
                        self.breach_fired.discard(track_id)
                
                # --- NEW TARGET / INFO EVENTS ---
                if track_id not in self.seen_tracks:
                    self.seen_tracks.add(track_id)
                    events.append({
                        "id": f"T-{track_id}",
                        "type": "TARGET_ACQUIRED",
                        "obj_class": obj_name,
                        "timestamp": time.time(),
                        "details": f"New {obj_name} acquired in sector."
                    })
                
                # If face is known but we haven't logged it yet, emit a warning
                # We can store a dict instead of set for seen_tracks if we wanted, but let's just use another cache
                if face_status and face_status.startswith("KNOWN:"):
                    cache_key = f"{track_id}_known"
                    if cache_key not in self.seen_tracks:
                        self.seen_tracks.add(cache_key)
                        events.append({
                            "id": f"T-{track_id}",
                            "type": "KNOWN_PERSON_DETECTED",
                            "identity": face_status.split("KNOWN:")[1],
                            "timestamp": time.time(),
                        })

        # --- DRAW TRIPWIRE ON FRAME ---
        if len(self.tripwire_points) > 1:
            h, w = raw_frame.shape[:2]
            scale_x = w / 1280.0
            scale_y = h / 720.0
            scaled_pts = [[int(pt[0] * scale_x), int(pt[1] * scale_y)] for pt in self.tripwire_points]
            pts = np.array(scaled_pts, np.int32).reshape((-1, 1, 2))
            is_poly = isinstance(self.tripwire_polygon, Polygon)
            cv2.polylines(display_frame, [pts], is_poly, (0, 165, 255), 2)

        # --- SATARKH AI MODULES (WEAPON & VIOLENCE) ---
        if self.frame_count % 3 == 0:
            if self.weapon_model:
                try:
                    w_res = self.weapon_model(raw_frame, verbose=False)[0]
                    for box in w_res.boxes:
                        if float(box.conf[0]) > 0.4:
                            x1w, y1w, x2w, y2w = map(int, box.xyxy[0])
                            cv2.rectangle(display_frame, (x1w, y1w), (x2w, y2w), (0, 0, 255), 2) # BGR
                            cv2.putText(display_frame, "WEAPON DETECTED", (x1w, y1w - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                            events.append({"id": f"W-{self.frame_count}", "type": "WEAPON_DETECTED", "timestamp": time.time()})
                except Exception as e:
                    print("Weapon detect error:", e)

            if self.violence_model:
                try:
                    v_res = self.violence_model(raw_frame, verbose=False)[0]
                    for box in v_res.boxes:
                        if float(box.conf[0]) > 0.65:
                            cls_name = self.violence_model.names[int(box.cls[0])].lower()
                            if cls_name == 'violence':
                                x1v, y1v, x2v, y2v = map(int, box.xyxy[0])
                                cv2.rectangle(display_frame, (x1v, y1v), (x2v, y2v), (0, 0, 255), 3)
                                cv2.putText(display_frame, "VIOLENCE DETECTED", (x1v, max(y1v - 20, 20)), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 3)
                                events.append({"id": f"V-{self.frame_count}", "type": "VIOLENCE_ANOMALY", "timestamp": time.time()})
                except Exception as e:
                    print("Violence detect error:", e)

        return display_frame, events
