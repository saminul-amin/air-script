"""
Record what the Python pipeline produces for each preprocessing fixture.

    cd ai-service
    python tools/make_preprocessing_fixtures.py

Reads every PNG in ``client/tests/fixtures/preprocessing`` (rendered by
``client/scripts/make-preprocessing-fixtures.ts``), runs the unchanged
``preprocess_image`` on it and the checksummed CharCNN on the result, and
writes ``expected.json`` next to the PNGs:

    {
      "pillow": "12.3.0", "numpy": "...", "torch": "...",
      "fixtures": {
        "<id>": {
          "blank": false,
          "input_f32_le_b64": "<784 little-endian float32 values, base64>",
          "top1": "H", "top3": ["H", "N", "M"], "confidence": 0.93
        }
      }
    }

The client's Vitest parity test compares its TypeScript port against these
arrays and labels. Nothing here is hand-edited.
"""

from __future__ import annotations

import base64
import json
import os
import sys

import numpy as np
import torch
from PIL import __version__ as pillow_version

HERE = os.path.dirname(os.path.abspath(__file__))
SERVICE_DIR = os.path.dirname(HERE)
sys.path.insert(0, SERVICE_DIR)

from export_onnx import load_verified_model  # noqa: E402
from model_loader import EMNIST_LABELS  # noqa: E402
from preprocessing import preprocess_image  # noqa: E402

FIXTURE_DIR = os.path.normpath(os.path.join(SERVICE_DIR, "..", "client", "tests", "fixtures", "preprocessing"))


def main() -> int:
    pngs = sorted(f for f in os.listdir(FIXTURE_DIR) if f.endswith(".png"))
    if not pngs:
        print(f"no PNG fixtures in {FIXTURE_DIR}; run the client script first", file=sys.stderr)
        return 1

    model = load_verified_model()
    fixtures: dict[str, dict] = {}
    for name in pngs:
        with open(os.path.join(FIXTURE_DIR, name), "rb") as fh:
            processed = preprocess_image(fh.read())
        fixture_id = name[:-4]
        if processed is None:
            fixtures[fixture_id] = {"blank": True}
            continue
        assert processed.shape == (28, 28) and processed.dtype == np.float32
        tensor = torch.from_numpy(processed).unsqueeze(0).unsqueeze(0)
        with torch.no_grad():
            probs = torch.softmax(model(tensor), dim=1)[0]
        top3_vals, top3_idx = torch.topk(probs, k=3)
        fixtures[fixture_id] = {
            "blank": False,
            "input_f32_le_b64": base64.b64encode(processed.astype("<f4").tobytes()).decode("ascii"),
            "top1": EMNIST_LABELS[int(top3_idx[0])],
            "top3": [EMNIST_LABELS[int(i)] for i in top3_idx],
            "confidence": round(float(top3_vals[0]), 4),
        }

    out = {
        "pillow": pillow_version,
        "numpy": np.__version__,
        "torch": torch.__version__,
        "fixtures": fixtures,
    }
    with open(os.path.join(FIXTURE_DIR, "expected.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, indent=1)
    blanks = sum(1 for f in fixtures.values() if f["blank"])
    print(f"recorded {len(fixtures)} fixtures ({blanks} blank) with Pillow {pillow_version} -> {FIXTURE_DIR}/expected.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
