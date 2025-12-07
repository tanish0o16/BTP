from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64

app = Flask(__name__)
CORS(app)  # Allow the browser to talk to this server

def process_land_value(image_bytes):
    # Decode image from bytes (received from web)
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return None

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray_float = gray.astype(np.float32) / 255.0

    # 1. ARTERIAL HIERARCHY
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    arterial_roads = cv2.erode(binary, kernel, iterations=1)
    dist_arterial = cv2.distanceTransform(cv2.bitwise_not(arterial_roads), cv2.DIST_L2, 5)
    arterial_val = cv2.normalize(dist_arterial, None, 0, 1.0, cv2.NORM_MINMAX)
    arterial_val = 1.0 - arterial_val
    arterial_val = cv2.GaussianBlur(arterial_val, (101, 101), 0)
    arterial_val = cv2.normalize(arterial_val, None, 0, 1.0, cv2.NORM_MINMAX)

    # 2. JUNCTION PREMIUM
    dst = cv2.cornerHarris(gray, blockSize=2, ksize=3, k=0.04)
    corner_mask = np.zeros_like(gray, dtype=np.uint8)
    corner_mask[dst > 0.005 * dst.max()] = 255
    junction_val = cv2.GaussianBlur(corner_mask, (151, 151), 0)
    junction_val = cv2.normalize(junction_val, None, 0, 1.0, cv2.NORM_MINMAX)

    # 3. ZONING INTENSITY
    mu = cv2.blur(gray_float, (25, 25))
    mu2 = cv2.blur(gray_float * gray_float, (25, 25))
    variance = mu2 - mu * mu
    sigma = np.sqrt(np.abs(variance))
    zoning_val = cv2.normalize(sigma, None, 0, 1, cv2.NORM_MINMAX)
    zoning_val = cv2.GaussianBlur(zoning_val, (51, 51), 0)

    # FUSION
    combined_score_float = (0.4 * arterial_val) + (0.3 * junction_val) + (0.3 * zoning_val)
    combined_score_smoothed = cv2.GaussianBlur(combined_score_float, (121, 121), 0)
    final_score = cv2.normalize(combined_score_smoothed, None, 0, 255, cv2.NORM_MINMAX)
    final_score_uint8 = np.uint8(final_score)

    # VISUALIZATION
    heatmap = cv2.applyColorMap(final_score_uint8, cv2.COLORMAP_JET)
    alpha_mask_base = final_score.astype(np.float32) / 255.0
    alpha_mask = (alpha_mask_base * 0.55) + 0.2
    alpha_mask = cv2.merge([alpha_mask, alpha_mask, alpha_mask])
    
    img_float = img.astype(np.float32) / 255.0
    heatmap_float = heatmap.astype(np.float32) / 255.0
    overlay = (heatmap_float * alpha_mask) + (img_float * (1.0 - alpha_mask))
    overlay = np.clip(overlay * 255, 0, 255).astype(np.uint8)

    # Encode back to Base64 to send to browser
    _, buffer = cv2.imencode('.png', overlay)
    img_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/png;base64,{img_str}"

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    
    file = request.files['image']
    image_bytes = file.read()
    
    try:
        processed_image_data = process_land_value(image_bytes)
        if processed_image_data:
            return jsonify({"processed_image": processed_image_data})
        else:
            return jsonify({"error": "Processing failed"}), 500
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Server running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)