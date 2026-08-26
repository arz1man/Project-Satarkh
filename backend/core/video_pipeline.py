import cv2
import numpy as np

class VideoPipeline:
    def __init__(self, source=0):
        """
        source: 0 for webcam, or a string path to a video file / RTSP stream.
        """
        self.source = source
        self.cap = cv2.VideoCapture(self.source)
        self.night_vision_enabled = False

    def change_source(self, new_source):
        self.source = new_source
        if self.cap:
            self.cap.release()
        self.cap = cv2.VideoCapture(self.source)
        
    def set_night_vision(self, enabled: bool):
        self.night_vision_enabled = enabled

    def _apply_night_vision(self, frame):
        """
        Applies a green colormap to simulate night vision / thermal optics.
        """
        # Convert to grayscale to remove original colors
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Increase contrast for that tactical look
        gray = cv2.equalizeHist(gray)
        
        # Apply a green colormap (or any custom green mapping)
        # COLORMAP_OCEAN has some green, but we can do it manually for a pure tactical green
        # A simple way: create a blank green image and blend, or use applyColorMap
        
        # For a truly military night vision look, manual channel mapping works best:
        zeros = np.zeros_like(gray)
        green_frame = cv2.merge([zeros, gray, zeros]) # B, G, R
        
        return green_frame

    def get_frame(self):
        """
        Reads the next frame from the stream.
        Returns the raw frame (for AI processing) and the display frame (for UI).
        """
        if not self.cap.isOpened():
            return None, None
            
        success, frame = self.cap.read()
        if not success:
            # If video ended, loop it (useful for pre-recorded demo)
            if isinstance(self.source, str):
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                success, frame = self.cap.read()
            if not success:
                return None, None
                
        display_frame = frame.copy()
        
        if self.night_vision_enabled:
            display_frame = self._apply_night_vision(display_frame)
            
        return frame, display_frame

    def release(self):
        self.cap.release()
