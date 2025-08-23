from flask import Flask, request, render_template, redirect, url_for, send_from_directory
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.image import load_img, img_to_array
import numpy as np
import os
import uuid

# ------------------ CONFIG ------------------
app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

IMG_HEIGHT, IMG_WIDTH = 128, 128
CLASS_NAMES = ['Fresh', 'Slightly_Aged', 'Stale', 'Spoiled', 'Rotten']

# 🔥 Choose the model you want (make sure the path is correct)
MODEL_PATH = r"C:\Users\User\AIFOOD\kmeans_saved_models\MobileNetV2_model.keras"
model = load_model(MODEL_PATH)

# ------------------ ROUTES ------------------
@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if "file" not in request.files:
            return "⚠️ No file uploaded", 400

        file = request.files["file"]
        if file.filename == "":
            return "⚠️ No file selected", 400

        # Save uploaded image with unique name
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(filepath)

        # Run prediction
        prediction, probs = predict_image(filepath)
        class_probs = list(zip(CLASS_NAMES, probs))

        return render_template("result.html",
                              filename=filename,
                              prediction=prediction,
                              class_probs=class_probs)

    return render_template("index.html")


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


# ------------------ PREDICTION FUNCTION ------------------
def predict_image(image_path):
    img = load_img(image_path, target_size=(IMG_HEIGHT, IMG_WIDTH))
    img_array = img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    prediction = model.predict(img_array)
    predicted_class = CLASS_NAMES[np.argmax(prediction)]
    return predicted_class, prediction[0]


# ------------------ MAIN ------------------
if __name__ == "__main__":
    app.run(debug=True)
