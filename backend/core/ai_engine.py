import cv2
import numpy as np
from shapely.geometry import Point, Polygon, LineString
from ultralytics import YOLO
import easyocr
from deepface import DeepFace
import time
import os
import threading

class AIEngine:
    def __init__(self):
        self.model = YOLO('yolov8n.pt')
        self.reader = easyocr.Reader(['en'], gpu=True)
        self.tripwire_points = []
        self.tripwire_polygon = None
        self.target_classes = [0, 2, 3, 5, 7]
        self.face_cache = {}
        # Tracks which IDs have already fired a breach event (to avoid spam)
        self.breach_fired = set()

    def set_tripwire(self, points):
        self.tripwire_points = points
        self.breach_fired = set()  # Reset on new zone
        if len(points) >= 3:
            self.tripwire_polygon = Polygon(points)
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

        if isinstance(self.tripwire_polygon, Polygon):
            return self.tripwire_polygon.contains(ground_point)
        elif isinstance(self.tripwire_polygon, LineString):
            # For a line, check if the point is within 5px of the line
            return self.tripwire_polygon.distance(ground_point) < 5
        return False

    def _extract_license_plate(self, frame, bbox):
        x1, y1, x2, y2 = bbox
        cropped = frame[int(y1):int(y2), int(x1):int(x2)]
        if cropped.size == 0:
            return None
        results = self.reader.readtext(cropped)
        if results:
            # Return highest-confidence result
            best = max(results, key=lambda r: r[2])
            if best[2] > 0.3:
                return best[1].upper().strip()
        return None

    def _run_face_rec_thread(self, cropped_person, track_id):
        """Runs FaceNet in a background thread — never blocks the video feed."""
        try:
            if cropped_person.size == 0:
                self.face_cache[track_id] = "UNKNOWN"
                return
            if not os.path.exists("registered_faces") or not any(
                f.lower().endswith(('.jpg', '.jpeg', '.png'))
                for f in os.listdir("registered_faces")
            ):
                self.face_cache[track_id] = "UNKNOWN"
                return

            dfs = DeepFace.find(
                img_path=cropped_person,
                db_path="registered_faces",
                model_name="Facenet",
                enforce_detection=False,
                align=False,
                silent=True,
                detector_backend="skip"
            )
            if len(dfs) > 0 and len(dfs[0]) > 0:
                matched_path = dfs[0].iloc[0]['identity']
                name = os.path.splitext(os.path.basename(matched_path))[0]
                self.face_cache[track_id] = f"KNOWN:{name}"
            else:
                self.face_cache[track_id] = "UNKNOWN"
        except Exception as e:
            print("Face check error:", e)
            self.face_cache[track_id] = "UNKNOWN"

    def process_frame(self, raw_frame, display_frame):
        events = []

        results = self.model.track(raw_frame, persist=True, classes=self.target_classes, verbose=False)

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
                    if track_id not in self.face_cache or self.face_cache[track_id] == "UNKNOWN":
                        # Only kick off a new thread if not already scanning
                        if self.face_cache.get(track_id) != "SCANNING":
                            self.face_cache[track_id] = "SCANNING"
                            t = threading.Thread(
                                target=self._run_face_rec_thread,
                                args=(raw_frame[y1:y2, x1:x2].copy(), track_id)
                            )
                            t.daemon = True
                            t.start()
                    face_status = self.face_cache.get(track_id, "SCANNING")

                # --- LICENSE PLATE (vehicles only, on breach) ---
                plate = None
                if class_id != 0 and is_breaching:
                    plate = self._extract_license_plate(raw_frame, box)

                # --- BOUNDING BOX COLOR ---
                # Red = breaching, Yellow = known person, Blue = normal
                if is_breaching:
                    color = (0, 0, 255)   # Red
                elif face_status and face_status.startswith("KNOWN"):
                    color = (0, 255, 255) # Yellow
                else:
                    color = (255, 140, 0) # Blue/Orange

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

                cv2.putText(display_frame, label, (x1, max(y1 - 10, 12)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

                # --- BREACH EVENTS ---
                # Universal alarm: everyone triggers on breach — face rec is identification only
                if is_breaching and track_id not in self.breach_fired:
                    self.breach_fired.add(track_id)
                    event = {
                        "id": track_id,
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

        # --- DRAW TRIPWIRE ON FRAME ---
        if len(self.tripwire_points) > 1:
            h, w = raw_frame.shape[:2]
            scale_x = w / 1280.0
            scale_y = h / 720.0
            scaled_pts = [[int(pt[0] * scale_x), int(pt[1] * scale_y)] for pt in self.tripwire_points]
            pts = np.array(scaled_pts, np.int32).reshape((-1, 1, 2))
            is_poly = isinstance(self.tripwire_polygon, Polygon)
            cv2.polylines(display_frame, [pts], is_poly, (0, 165, 255), 2)

        return display_frame, events
