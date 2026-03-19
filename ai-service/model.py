"""
model.py — CNN architecture definition and model loading utilities.

The model is a lightweight CNN trained on the EMNIST-balanced dataset
(47 classes: digits 0-9, uppercase A-Z, and selected lowercase letters).

Architecture:
    Conv2D(32) → Conv2D(64) → MaxPool → Dropout →
    Conv2D(128) → MaxPool → Dropout →
    Flatten → Dense(256) → Dropout → Dense(47)
"""

import os
import torch
import torch.nn as nn

MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "emnist_cnn.pth")

# EMNIST-balanced class mapping (47 classes)
# 0-9  → '0'-'9'
# 10-35 → 'A'-'Z'
# 36-46 → 'a','b','d','e','f','g','h','n','q','r','t'
EMNIST_BALANCED_LABELS = (
    list("0123456789")
    + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    + list("abdefghnqrt")
)


class CharCNN(nn.Module):
    """Lightweight CNN for 28×28 single-channel character images."""

    def __init__(self, num_classes: int = 47):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout(0.25),

            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout(0.25),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 7 * 7, 256), nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = self.classifier(x)
        return x


def build_model(num_classes: int = 47) -> CharCNN:
    """Build and return a new (untrained) CNN."""
    return CharCNN(num_classes)


def load_model() -> CharCNN:
    """Load the trained model from disk. Falls back to untrained model if not found."""
    model = build_model()
    if os.path.exists(MODEL_PATH):
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
        print(f"[model] Loaded weights from {MODEL_PATH}")
    else:
        print(f"[model] WARNING: No trained weights at {MODEL_PATH}. "
              "Run train.py first. Predictions will be random.")
    model.eval()
    return model
