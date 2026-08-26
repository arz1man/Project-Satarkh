import cv2
import numpy as np
from shapely.geometry import Point, Polygon, LineString
from ultralytics import YOLO
import easyocr
from deepface import DeepFace
import time
import os

class AIEngine:
    def __init__(self):
        # Load YOLOv8 for object detection (Person=0, Vehicle classes=2,3,5,7)
        self.model = YOLO('yolov8n.pt') 
        
        # Initialize EasyOCR for license plates
        # Using CPU by default, can use GPU if VRAM allows
        self.reader = easyocr.Reader(['en'], gpu=True)
        
        # Virtual Tripwire definition (Polygon or Line)
        # Empty list means no tripwire is set yet
        self.tripwire_points = []
        self.tripwire_polygon = None
        
        # Target classes for perimeter breach (person, car, motorcycle, bus, truck)
        self.target_classes = [0, 2, 3, 5, 7]
        
    def set_tripwire(self, points):
        """
        Sets the virtual tripwire coordinates.
        points: list of (x, y) tuples.
        """
        self.tripwire_points = points
        if len(points) >= 3:
            self.tripwire_polygon = Polygon(points)
        elif len(points) == 2:
            self.tripwire_polygon = LineString(points)
        else:
            self.tripwire_polygon = None

    def _check_breach(self, bbox, frame_shape):
        """
        Checks if the bounding box intersects the virtual tripwire.
        Scales the raw bounding box down to the frontend UI's 1280x720 mapping.
        """
        if not self.tripwire_polygon:
            return False
            
        x1, y1, x2, y2 = bbox
        h, w = frame_shape[:2]
        
        scale_x = 1280.0 / w
        scale_y = 720.0 / h
        
        sx1, sy1 = x1 * scale_x, y1 * scale_y
        sx2, sy2 = x2 * scale_x, y2 * scale_y
        
        # Create a Polygon representing the object's bounding box
        bbox_poly = Polygon([(sx1, sy1), (sx2, sy1), (sx2, sy2), (sx1, sy2)])
        
        if isinstance(self.tripwire_polygon, Polygon):
            return self.tripwire_polygon.intersects(bbox_poly)
        elif isinstance(self.tripwire_polygon, LineString):
            return self.tripwire_polygon.intersects(bbox_poly)
        return False

    def _extract_license_plate(self, frame, bbox):
        x1, y1, x2, y2 = bbox
        cropped_vehicle = frame[int(y1):int(y2), int(x1):int(x2)]
        if cropped_vehicle.size == 0:
            return None
        
        results = self.reader.readtext(cropped_vehicle)
        if results:
            # Return the highest confidence text
            return results[0][1]
        return None

    def _check_face(self, frame, bbox):
        """
        Runs DeepFace to verify if the face is in the registered database.
        (For MVP, we just detect if a face exists in the bbox).
        """
        x1, y1, x2, y2 = bbox
        cropped_person = frame[int(y1):int(y2), int(x1):int(x2)]
        if cropped_person.size == 0:
            return "Unknown"
            
        try:
            # Check if there are actually files in the db_path to avoid DeepFace errors
            if not os.path.exists("registered_faces") or len(os.listdir("registered_faces")) == 0:
                return "Unregistered Target"
                
            dfs = DeepFace.find(img_path = cropped_person, db_path = "registered_faces", enforce_detection=False, silent=True)
            if len(dfs) > 0 and len(dfs[0]) > 0:
                # Get the matched filename without extension
                matched_path = dfs[0].iloc[0]['identity']
                filename = os.path.basename(matched_path)
                name = os.path.splitext(filename)[0]
                return f"REGISTERED: {name}"
            
            return "Unregistered Target"
        except Exception as e:
            print("Face check error:", e)
            return "Unknown"

    def process_frame(self, raw_frame, display_frame):
        """
        Runs the full AI pipeline on the frame.
        """
        events = []
        
        # 1. Run YOLOv8 Tracking
        results = self.model.track(raw_frame, persist=True, classes=self.target_classes, verbose=False)
        
        if results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            track_ids = results[0].boxes.id.int().cpu().tolist()
            class_ids = results[0].boxes.cls.int().cpu().tolist()
            
            for box, track_id, class_id in zip(boxes, track_ids, class_ids):
                x1, y1, x2, y2 = map(int, box)
                
                # Check Tripwire Breach
                is_breaching = self._check_breach((x1, y1, x2, y2), raw_frame.shape)
                
                color = (0, 0, 255) if is_breaching else (255, 0, 0)
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), color, 2)
                
                label = f"ID: {track_id} "
                
                if is_breaching:
                    event_type = "PERSON_BREACH" if class_id == 0 else "VEHICLE_BREACH"
                    events.append({
                        "id": track_id,
                        "type": event_type,
                        "timestamp": time.time()
                    })
                    
                    # If Vehicle, try ALPR
                    if class_id != 0:
                        plate = self._extract_license_plate(raw_frame, box)
                        if plate:
                            label += f" | Plate: {plate}"
                            events[-1]["plate"] = plate
                            
                    # If Person, try Face Rec
                    if class_id == 0:
                        face_status = self._check_face(raw_frame, box)
                        label += f" | {face_status}"
                        events[-1]["face"] = face_status
                
                cv2.putText(display_frame, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        # Draw the tripwire on the display frame
        if len(self.tripwire_points) > 1:
            h, w = raw_frame.shape[:2]
            scale_x = w / 1280.0
            scale_y = h / 720.0
            
            scaled_pts = []
            for pt in self.tripwire_points:
                scaled_pts.append([int(pt[0] * scale_x), int(pt[1] * scale_y)])
                
            pts = np.array(scaled_pts, np.int32)
            pts = pts.reshape((-1, 1, 2))
            if self.tripwire_polygon and isinstance(self.tripwire_polygon, Polygon):
                cv2.polylines(display_frame, [pts], True, (0, 165, 255), 2) # Orange for tripwire
            else:
                cv2.polylines(display_frame, [pts], False, (0, 165, 255), 2)

        return display_frame, events
