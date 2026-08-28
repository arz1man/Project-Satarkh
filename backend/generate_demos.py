import cv2
import numpy as np
import urllib.request
import os

os.makedirs('uploaded_footage', exist_ok=True)

def create_video_from_url(url, filename, duration_sec=5, fps=30):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req)
        arr = np.asarray(bytearray(res.read()), dtype=np.uint8)
        img = cv2.imdecode(arr, -1)
        if img is None:
            print("Failed to decode image from", url)
            return
        
        img = cv2.resize(img, (1280, 720))
        out = cv2.VideoWriter(filename, cv2.VideoWriter_fourcc(*'mp4v'), fps, (1280, 720))
        for _ in range(duration_sec * fps):
            out.write(img)
        out.release()
        print("Generated", filename)
    except Exception as e:
        print("Error generating", filename, e)

# Image of a gun
create_video_from_url('https://upload.wikimedia.org/wikipedia/commons/e/e6/Glock_17_Gen_4.jpg', 'uploaded_footage/weapon_demo.mp4')

# Image of people fighting (boxing)
create_video_from_url('https://upload.wikimedia.org/wikipedia/commons/1/1a/Boxing_match_in_a_ring.jpg', 'uploaded_footage/violence_demo.mp4')
