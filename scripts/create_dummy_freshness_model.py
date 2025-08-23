"""
Create a minimal Keras classification model compatible with predict_cli.py

This creates FOOD-FRESHNESS-master/model.keras with input shape (128,128,3)
and 5-way softmax output for classes:
['Fresh', 'Slightly_Aged', 'Stale', 'Spoiled', 'Rotten']
"""
import os
import pathlib

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def build_model():
    inputs = keras.Input(shape=(128, 128, 3))
    x = layers.Rescaling(1.0)(inputs)
    x = layers.Conv2D(8, 3, activation="relu")(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Conv2D(16, 3, activation="relu")(x)
    x = layers.MaxPooling2D()(x)
    x = layers.Flatten()(x)
    x = layers.Dense(32, activation="relu")(x)
    outputs = layers.Dense(5, activation="softmax")(x)
    model = keras.Model(inputs, outputs)
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy")
    return model


def main():
    root = pathlib.Path(__file__).resolve().parents[1]
    out_dir = root / "FOOD-FRESHNESS-master"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "model.keras"
    model = build_model()
    # Save untrained model; good enough to enable predictor end-to-end
    model.save(out_path)
    print(f"Saved model to {out_path}")


if __name__ == "__main__":
    main()
