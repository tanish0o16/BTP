import cv2
import numpy as np
from sklearn.cluster import KMeans

# Load image
img_path = "Capture.PNG"
img = cv2.imread(img_path)

# --- Resize for fast processing ---
scale = 0.4
img_small = cv2.resize(img, (0,0), fx=scale, fy=scale)

# -------- 1. Boundary Map --------
gray = cv2.cvtColor(img_small, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 100, 200)
boundary_map = img_small.copy()
cnts, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
cv2.drawContours(boundary_map, cnts, -1, (0,0,255), 1)
cv2.imwrite("boundary_map.png", boundary_map)

# -------- 2. Classification Map (Fast KMeans) --------
Z = img_small.reshape((-1,3))
kmeans = KMeans(n_clusters=3, n_init=5, random_state=42)
labels = kmeans.fit_predict(Z)
centers = np.uint8(kmeans.cluster_centers_)
classified = centers[labels].reshape(img_small.shape)
cv2.imwrite("classification_map.png", classified)

# -------- 3. Terrain / Gradient Map --------
sobelx = cv2.Sobel(gray, cv2.CV_32F, 1, 0)
sobely = cv2.Sobel(gray, cv2.CV_32F, 0, 1)
gradient = np.sqrt(sobelx**2 + sobely**2)
gradient_norm = cv2.normalize(gradient, None, 0, 255, cv2.NORM_MINMAX)
terrain_map = cv2.applyColorMap(gradient_norm.astype(np.uint8), cv2.COLORMAP_JET)
cv2.imwrite("terrain_map.png", terrain_map)

# -------- 4. Resource / Hotspot Map --------
blur = cv2.GaussianBlur(gray, (9,9), 0)
_, thresh = cv2.threshold(blur, 180, 255, cv2.THRESH_BINARY)
cnts2, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
resource_map = img_small.copy()
for c in cnts2:
    x, y, w, h = cv2.boundingRect(c)
    if w*h > 80:  # filter noise
        cv2.rectangle(resource_map, (x,y), (x+w,y+h), (0,0,255), 2)
cv2.imwrite("resource_map.png", resource_map)

{
    "boundary_map": "/mnt/data/boundary_map.png",
    "classification_map": "/mnt/data/classification_map.png",
    "terrain_map": "/mnt/data/terrain_map.png",
    "resource_map": "/mnt/data/resource_map.png"
}
