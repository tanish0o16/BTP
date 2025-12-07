import cv2
import numpy as np
import matplotlib.pyplot as plt

def analyze_smooth_land_value(image_path):
    # 1. Setup
    img = cv2.imread(image_path)
    if img is None:
        print("Error: Image not found.")
        return
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    gray_float = gray.astype(np.float32) / 255.0

    # ==========================================================
    # METRIC 1: ARTERIAL HIERARCHY (Road Width Analysis)
    # ==========================================================
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    arterial_roads = cv2.erode(binary, kernel, iterations=1)
    
    # Calculate distance and invert
    dist_arterial = cv2.distanceTransform(cv2.bitwise_not(arterial_roads), cv2.DIST_L2, 5)
    arterial_val = cv2.normalize(dist_arterial, None, 0, 1.0, cv2.NORM_MINMAX)
    arterial_val = 1.0 - arterial_val
    
    # --- SMOOTHING FIX 1: Soften the Arterial Impact ---
    # Instead of a sharp power curve, we apply a heavy blur here first.
    # This makes the high value near roads spread out wider and softer.
    # Kernel size (ksize) must be odd numbers. (101, 101) is a strong blur.
    arterial_val = cv2.GaussianBlur(arterial_val, (101, 101), 0)
    arterial_val = cv2.normalize(arterial_val, None, 0, 1.0, cv2.NORM_MINMAX) # Re-normalize

    # ==========================================================
    # METRIC 2: THE JUNCTION PREMIUM (Harris Corners)
    # ==========================================================
    dst = cv2.cornerHarris(gray, blockSize=2, ksize=3, k=0.04)
    corner_mask = np.zeros_like(gray, dtype=np.uint8)
    # Lower threshold slightly to catch more subtle intersections
    corner_mask[dst > 0.005 * dst.max()] = 255
    
    # --- SMOOTHING FIX 2: Increase Junction Influence ---
    # Increased kernel size from (101,101) to (151,151) to make the
    # "hotspots" at intersections larger and blend into each other more.
    junction_val = cv2.GaussianBlur(corner_mask, (151, 151), 0)
    junction_val = cv2.normalize(junction_val, None, 0, 1.0, cv2.NORM_MINMAX)

    # ==========================================================
    # METRIC 3: ZONING INTENSITY (Local Variance)
    # ==========================================================
    mu = cv2.blur(gray_float, (25, 25))
    mu2 = cv2.blur(gray_float * gray_float, (25, 25))
    variance = mu2 - mu * mu
    sigma = np.sqrt(np.abs(variance))
    zoning_val = cv2.normalize(sigma, None, 0, 1, cv2.NORM_MINMAX)
    
    # This metric is already naturally smooth, but a little extra helps blend.
    zoning_val = cv2.GaussianBlur(zoning_val, (51, 51), 0)

    # ==========================================================
    # FUSION & MASTER SMOOTHING
    # ==========================================================
    # Combine weights
    combined_score_float = (0.4 * arterial_val) + (0.3 * junction_val) + (0.3 * zoning_val)
    
    # --- SMOOTHING FIX 3: THE FINAL BLEND ---
    # Before converting to a heatmap, we apply one final, large Gaussian blur
    # to the combined score. This eliminates any remaining hard edges where
    # different metrics overlap inconsistently.
    combined_score_smoothed = cv2.GaussianBlur(combined_score_float, (121, 121), 0)
    
    # Final Normalize to 0-255 uint8
    final_score = cv2.normalize(combined_score_smoothed, None, 0, 255, cv2.NORM_MINMAX)
    final_score_uint8 = np.uint8(final_score)

    # ==========================================================
    # VISUALIZATION (Smoother Alpha Transitions)
    # ==========================================================
    heatmap = cv2.applyColorMap(final_score_uint8, cv2.COLORMAP_JET)
    
    # Create smoother alpha mask based on the smoothed score
    # Low value gets 0.2 opacity, high value gets up to 0.75 opacity
    alpha_mask_base = final_score.astype(np.float32) / 255.0
    alpha_mask = (alpha_mask_base * 0.55) + 0.2
    alpha_mask = cv2.merge([alpha_mask, alpha_mask, alpha_mask])
    
    # Blend
    img_float = img.astype(np.float32) / 255.0
    heatmap_float = heatmap.astype(np.float32) / 255.0
    overlay = (heatmap_float * alpha_mask) + (img_float * (1.0 - alpha_mask))
    overlay = np.clip(overlay * 255, 0, 255).astype(np.uint8)

    # Save the overlay image
    cv2.imwrite('smoothed_land_value_heatmap.png', overlay)

    plt.figure(figsize=(12, 10))
    plt.imshow(cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB))
    plt.title("Smoothed Land Value Heatmap\n(High Diffusion applied to metrics)")
    plt.axis('off')
    plt.show()

# Run it
analyze_smooth_land_value('tanishbtp.jpg')