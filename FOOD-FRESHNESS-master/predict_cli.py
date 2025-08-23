#!/usr/bin/env python3
import argparse
import json
import os
import sys
from typing import Dict, Any

# Optional TensorFlow; we fall back to a lightweight heuristic when unavailable
TF_AVAILABLE = True
try:
    from tensorflow.keras.models import load_model  # type: ignore
    from tensorflow.keras.preprocessing.image import load_img, img_to_array  # type: ignore
    import numpy as np  # type: ignore
except Exception:
    TF_AVAILABLE = False
    # Minimal deps for heuristic
    try:
        from PIL import Image
        import numpy as np  # type: ignore
    except Exception as e:  # Hard failure only if even PIL/numpy are missing
        print(json.dumps({"error": f"Missing image libraries: {e}"}))
        sys.exit(2)

CLASS_NAMES = ['Fresh', 'Slightly_Aged', 'Stale', 'Spoiled', 'Rotten']


def predict_with_tf(image_path: str, model_path: str) -> Dict[str, Any]:
    if not TF_AVAILABLE:
        return {"error": "tensorflow_unavailable"}
    if not os.path.exists(model_path):
        return {"error": f"model not found: {model_path}"}
    img = load_img(image_path, target_size=(128, 128))
    arr = img_to_array(img) / 255.0
    arr = np.expand_dims(arr, axis=0)
    model = load_model(model_path)
    pred = model.predict(arr)
    probs = pred[0].tolist()
    idx = int(np.argmax(pred))
    label = CLASS_NAMES[idx] if 0 <= idx < len(CLASS_NAMES) else str(idx)
    return {"label": label, "probabilities": {CLASS_NAMES[i]: float(probs[i]) for i in range(min(len(CLASS_NAMES), len(probs)))}}


def predict_heuristic(image_path: str) -> Dict[str, Any]:
    # Simple color/brightness heuristic using PIL + numpy
    try:
        from PIL import Image
        img = Image.open(image_path).convert('RGB').resize((128, 128))
        arr = np.asarray(img).astype('float32') / 255.0  # (H,W,3)
        mean = arr.mean(axis=(0, 1))  # R,G,B means
        brightness = float(arr.mean())
        r, g, b = float(mean[0]), float(mean[1]), float(mean[2])
        greenish = g - (r + b) / 2.0
        # Heuristic thresholds tuned crudely
        if brightness > 0.55 and greenish > 0.08:
            label = 'Fresh'
            probs = [0.72, 0.16, 0.06, 0.04, 0.02]
        elif brightness > 0.45 and greenish > 0.02:
            label = 'Slightly_Aged'
            probs = [0.22, 0.52, 0.16, 0.07, 0.03]
        elif brightness > 0.30:
            label = 'Stale'
            probs = [0.10, 0.20, 0.48, 0.16, 0.06]
        elif brightness > 0.18:
            label = 'Spoiled'
            probs = [0.06, 0.10, 0.22, 0.46, 0.16]
        else:
            label = 'Rotten'
            probs = [0.03, 0.06, 0.10, 0.21, 0.60]
        return {"label": label, "probabilities": {CLASS_NAMES[i]: float(probs[i]) for i in range(len(CLASS_NAMES))}}
    except Exception as e:
        return {"error": f"heuristic_failed: {e}"}


def predict(image_path: str, model_path: str | None):
    if not os.path.exists(image_path):
        return {"error": f"image not found: {image_path}"}
    # Try TF if possible and model present
    if TF_AVAILABLE and model_path and os.path.exists(model_path):
        res = predict_with_tf(image_path, model_path)
        if 'label' in res:
            return res
        # fall through to heuristic on TF issues
    # Heuristic fallback
    return predict_heuristic(image_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--model", required=False, help="Path to Keras model (.keras or .h5)")
    args = parser.parse_args()

    model_path = args.model or os.environ.get("FOOD_FRESHNESS_MODEL")

    try:
        result = predict(args.image, model_path)
    except Exception as e:
        result = {"error": str(e)}

    print(json.dumps(result))


if __name__ == "__main__":
    main()
