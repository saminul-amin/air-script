"""
preprocessing.py — Robust image preprocessing for character recognition.

Pipeline:
    1. Decode raw image bytes → PIL RGBA
    2. Composite onto black background
    3. Convert to grayscale
    4. Gaussian blur (noise reduction)
    5. Binary threshold (clean edges)
    6. Dilate thin strokes (avoid bias toward "I" / "1")
    7. Auto-crop to bounding box of content
    8. Pad + center into square
    9. Resize to 28×28
   10. Normalize [0, 1], ensure white-on-black
"""

# I have taken help from AI but wrote the code myself. I understand that the code is not perfect and may require further adjustments, but I have done my best to implement a robust preprocessing pipeline for character recognition.

import io
import numpy as np
from PIL import Image, ImageFilter


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Full preprocessing pipeline. Returns a (28, 28) float32 numpy array
    normalized to [0, 1] with white character on black background.
    Returns None if the image is blank.
    """
    # 1. Decode
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

    # 2. Composite onto black background
    background = Image.new("RGBA", img.size, (0, 0, 0, 255))
    composite = Image.alpha_composite(background, img)

    # 3. Grayscale
    gray = composite.convert("L")

    # 4. Gaussian blur — reduces noise and smooths jagged strokes
    blurred = gray.filter(ImageFilter.GaussianBlur(radius=1.5))

    # 5. Binary threshold — clean separation of stroke vs background
    arr = np.array(blurred, dtype=np.float32)
    threshold = 30  # pixels above this are considered part of the stroke
    binary = (arr > threshold).astype(np.float32) * 255.0

    # 6. Dilate thin strokes — expand by 1px to avoid skinny lines being lost
    #    Use PIL's MaxFilter which is a fast morphological dilation
    binary_img = Image.fromarray(binary.astype(np.uint8), mode="L")
    dilated = binary_img.filter(ImageFilter.MaxFilter(size=3))
    arr = np.array(dilated, dtype=np.float32)

    # 7. Auto-crop to bounding box of non-zero content
    coords = np.argwhere(arr > 0)
    if coords.size == 0:
        return None  # blank image

    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)

    # Add generous padding (20% of the larger dimension, min 4px)
    h = y_max - y_min
    w = x_max - x_min
    pad = max(int(max(h, w) * 0.20), 4)
    y_min = max(0, y_min - pad)
    x_min = max(0, x_min - pad)
    y_max = min(arr.shape[0], y_max + pad)
    x_max = min(arr.shape[1], x_max + pad)

    cropped = Image.fromarray(arr[y_min:y_max, x_min:x_max].astype(np.uint8), mode="L")

    # 8. Pad into a square, centered
    cw, ch = cropped.size
    size = max(cw, ch)
    square = Image.new("L", (size, size), 0)
    offset = ((size - cw) // 2, (size - ch) // 2)
    square.paste(cropped, offset)

    # 9. Resize to 28×28 with high-quality resampling
    resized = square.resize((28, 28), Image.LANCZOS)

    # 10. Normalize to [0, 1]
    result = np.array(resized, dtype=np.float32) / 255.0

    # Ensure white-on-black (EMNIST convention)
    if result.mean() > 0.5:
        result = 1.0 - result

    return result
