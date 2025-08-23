#!/usr/bin/env python3
import argparse
import json
import os
import sys

try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.image import load_img, img_to_array
    import numpy as np
except Exception as e:
    print(json.dumps({"error": f"Missing TensorFlow or dependencies: {e}"}))
    sys.exit(2)

CLASS_NAMES = ['Fresh', 'Slightly_Aged', 'Stale', 'Spoiled', 'Rotten']

def predict(image_path: str, model_path: str):
    if not os.path.exists(image_path):
        return {"error": f"image not found: {image_path}"}
    if not os.path.exists(model_path):
        return {"error": f"model not found: {model_path}"}

    model = load_model(model_path)
    img = load_img(image_path, target_size=(128, 128))
    arr = img_to_array(img) / 255.0
    arr = np.expand_dims(arr, axis=0)
    pred = model.predict(arr)
    probs = pred[0].tolist()
    idx = int(np.argmax(pred))
    label = CLASS_NAMES[idx] if 0 <= idx < len(CLASS_NAMES) else str(idx)
    return {"label": label, "probabilities": {CLASS_NAMES[i]: float(probs[i]) for i in range(min(len(CLASS_NAMES), len(probs)))}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--model", required=False, help="Path to Keras model (.keras or .h5)")
    args = parser.parse_args()

    model_path = args.model or os.environ.get("FOOD_FRESHNESS_MODEL") or "model.keras"

    try:
        result = predict(args.image, model_path)
    except Exception as e:
        result = {"error": str(e)}

    print(json.dumps(result))

if __name__ == "__main__":
    main()
