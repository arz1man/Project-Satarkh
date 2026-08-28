from huggingface_hub import snapshot_download
import os
import shutil

os.makedirs('weights', exist_ok=True)

print("Downloading Weapon Detection Model...")
try:
    path = snapshot_download(repo_id="Subh775/Threat-Detection-YOLOv8n", allow_patterns="*.pt")
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith('.pt'):
                shutil.copy(os.path.join(root, file), 'weights/weapon_detection.pt')
                break
    print("Weapon model downloaded successfully!")
except Exception as e:
    print(f"Error downloading weapon model: {e}")

print("Downloading Violence Detection Model...")
try:
    path = snapshot_download(repo_id="Musawer14/fight_detection_yolov8", allow_patterns="*.pt")
    for root, dirs, files in os.walk(path):
        for file in files:
            if file.endswith('.pt'):
                shutil.copy(os.path.join(root, file), 'weights/violence_detection.pt')
                break
    print("Violence model downloaded successfully!")
except Exception as e:
    print(f"Error downloading violence model: {e}")
