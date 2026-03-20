"""
predict.py — Inference logic using the new preprocessing pipeline.

Uses model_loader for a JIT-traced singleton model and
preprocessing.py for the robust image pipeline.
Returns top-1 prediction with confidence and top-3 alternatives.
"""

import torch
import numpy as np

from model_loader import get_model, EMNIST_LABELS
from preprocessing import preprocess_image

_model = get_model()


def predict_character(image_bytes: bytes) -> dict:
    """
    Full prediction pipeline:
        image bytes → preprocess → inference → top-3 results
    """
    processed = preprocess_image(image_bytes)

    if processed is None:
        return {
            "prediction": "",
            "confidence": 0.0,
            "top3": [],
        }

    tensor = torch.from_numpy(processed).unsqueeze(0).unsqueeze(0)

    with torch.no_grad():
        logits = _model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    top3_vals, top3_idxs = torch.topk(probs, k=3)
    top3 = []
    for val, idx in zip(top3_vals, top3_idxs):
        i = int(idx.item())
        label = EMNIST_LABELS[i] if i < len(EMNIST_LABELS) else "?"
        top3.append({"label": label, "confidence": round(float(val.item()), 4)})

    best = top3[0]

    return {
        "prediction": best["label"],
        "confidence": best["confidence"],
        "top3": [entry["label"] for entry in top3],
    }
