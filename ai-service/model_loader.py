"""
model_loader.py — Singleton model loading with CPU optimization.

Loads the pre-trained EMNIST CNN once, applies torch.jit.trace for
faster CPU inference, and exposes it as a module-level singleton.
"""

import os
import torch
from model import CharCNN

MODEL_PATH = os.path.join(os.path.dirname(__file__), "saved_model", "emnist_cnn.pth")

# EMNIST-balanced class mapping (47 classes)
EMNIST_LABELS = (
    list("0123456789")
    + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    + list("abdefghnqrt")
)

_model = None
_traced_model = None


def get_model():
    """Return the loaded model (lazy singleton). Uses TorchScript tracing for CPU speed."""
    global _model, _traced_model

    if _traced_model is not None:
        return _traced_model

    _model = CharCNN(num_classes=47)
    if os.path.exists(MODEL_PATH):
        _model.load_state_dict(
            torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        )
        print(f"[model_loader] Loaded weights from {MODEL_PATH}")
    else:
        print(f"[model_loader] WARNING: No weights at {MODEL_PATH}. Run train.py first.")

    _model.eval()

    dummy = torch.randn(1, 1, 28, 28)
    _traced_model = torch.jit.trace(_model, dummy)
    _traced_model.eval()
    print("[model_loader] Model traced with TorchScript for fast CPU inference")

    return _traced_model
