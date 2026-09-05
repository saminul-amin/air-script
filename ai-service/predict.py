"""
predict.py — Inference logic using the preprocessing pipeline.

Uses model_loader for a JIT-traced singleton model and
preprocessing.py for the robust image pipeline.
Returns top-1 prediction with confidence and top-3 alternatives.

``predict_character`` raises ``ModelNotReadyError`` if trained weights
are unavailable — callers must surface that, never fall back.
"""

import torch

from model_loader import get_model, EMNIST_LABELS, ModelNotReadyError  # noqa: F401 — re-exported
from preprocessing import preprocess_image


def predict_character(image_bytes: bytes) -> dict:
    """
    Full prediction pipeline:
        image bytes → preprocess → inference → top-3 results
    """
    model = get_model()  # raises ModelNotReadyError when weights are absent

    processed = preprocess_image(image_bytes)

    if processed is None:
        return {
            "prediction": "",
            "confidence": 0.0,
            "top3": [],
            "top3_confidences": [],
        }

    tensor = torch.from_numpy(processed).unsqueeze(0).unsqueeze(0)

    with torch.no_grad():
        logits = model(tensor)
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
        "top3_confidences": [entry["confidence"] for entry in top3],
    }
