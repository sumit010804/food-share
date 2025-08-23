from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import numpy as np
import uvicorn
import os
import tempfile
import shutil
import requests

IMG_HEIGHT, IMG_WIDTH = 128, 128
CLASS_NAMES = ['Fresh', 'Slightly_Aged', 'Stale', 'Spoiled', 'Rotten']

MODEL_PATH = os.getenv('FOOD_FRESHNESS_MODEL', os.path.join(os.getcwd(), 'model.keras'))
MODEL_URL = os.getenv('FOOD_FRESHNESS_MODEL_URL')
model = None

app = FastAPI(title="Food Freshness Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def load_tf_model():
    global model
    path = MODEL_PATH
    # Optionally download the model from a URL on startup
    if MODEL_URL:
        try:
            os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
            r = requests.get(MODEL_URL, stream=True, timeout=60)
            r.raise_for_status()
            with open(path, 'wb') as f:
                shutil.copyfileobj(r.raw, f)
        except Exception as e:
            # If download fails, keep going and attempt to load whatever is present
            print(f"[freshness] model download failed: {e}")
    model = load_model(path)


@app.post("/predict")
async def predict(image: UploadFile = File(...)):
    try:
        # Persist to a temp file for TF loader
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(image.filename or '')[-1] or '.jpg') as tmp:
            content = await image.read()
            tmp.write(content)
            tmp_path = tmp.name

        img = load_img(tmp_path, target_size=(IMG_HEIGHT, IMG_WIDTH))
        arr = img_to_array(img) / 255.0
        arr = np.expand_dims(arr, axis=0)
        pred = model.predict(arr)
        idx = int(np.argmax(pred))
        label = CLASS_NAMES[idx]
        probs = { CLASS_NAMES[i]: float(pred[0][i]) for i in range(len(CLASS_NAMES)) }
        return JSONResponse({ "label": label, "probabilities": probs })
    except Exception as e:
        return JSONResponse({ "error": str(e) }, status_code=500)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
