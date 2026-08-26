import cv2
import numpy as np
import os

DEMO_VIDEO_PATH = "demo.mp4"

class VideoPipeline:
    def __init__(self, source=None):
        # Default: use demo.mp4 if it exists, else fall back to webcam
        if source is None:
            source = DEMO_VIDEO_PATH if os.path.exists(DEMO_VIDEO_PATH) else 0
        self.source = source
        self.night_vision_enabled = False
        self._init_camera()

    def change_source(self, new_source):
        self.source = new_source
        if self.cap:
            self.cap.release()
        self._init_camera()

    def _init_camera(self):
        src = self.source
        if isinstance(src, int) or (isinstance(src, str) and src.isdigit()):
            # USB webcam — use DirectShow + MJPG for full 720p/1080p resolution on Windows
            self.cap = cv2.VideoCapture(int(src), cv2.CAP_DSHOW)
            try:
                if self.cap.isOpened():
                    self.cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
                    self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
                    self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
            except Exception as e:
                print(f"Warning: Could not set advanced webcam properties: {e}")
        else:
            # File path or IP camera / RTSP — let OpenCV handle it natively
            self.cap = cv2.VideoCapture(str(src))

    def set_night_vision(self, enabled: bool):
        self.night_vision_enabled = enabled

    def _apply_night_vision(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        zeros = np.zeros_like(gray)
        return cv2.merge([zeros, gray, zeros])

    def get_frame(self):
        if not self.cap or not self.cap.isOpened():
            return None, None

        success, frame = self.cap.read()
        if not success:
            # Loop video file when it ends (great for demo footage)
            if isinstance(self.source, str) and not self.source.isdigit():
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                success, frame = self.cap.read()
            if not success:
                return None, None

        # FORCE RESIZE TO 1280x720
        # This guarantees a perfect 16:9 aspect ratio so the frontend SVG viewBox
        # perfectly aligns with the video pixels, preventing coordinate drift on 4:3 webcams.
        frame = cv2.resize(frame, (1280, 720))

        display_frame = frame.copy()
        if self.night_vision_enabled:
            display_frame = self._apply_night_vision(display_frame)

        return frame, display_frame

    def release(self):
        if self.cap:
            self.cap.release()
