"""
evaluate_bn.py — Measure the Bengali recogniser on held-out BanglaLekha writers.

    cd ai-service
    python evaluate_bn.py [--out ../docs]

Reports PyTorch (bn_cnn.pth) and every bn_cnn*.onnx export on the test split
of preprocessing_bn.split_by_writer (15% of writer forms, never trained on):
top-1, top-3, per-class accuracy, the ten most confused pairs and a
confusion-matrix image. Writes <out>/accuracy-bengali.json and
<out>/confusion-matrix-bengali.png and prints a Markdown summary.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import date

import numpy as np
import torch

from evaluate import markdown_summary, metrics, save_confusion_png
from export_onnx import SAVED, onnx_logits, torch_logits
from export_onnx_bn import load_verified_model_bn
from model_bn import BENGALI_LABELS
from preprocessing_bn import load_cache, split_by_writer, to_float

_HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(_HERE, "..", "docs"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=DEFAULT_OUT)
    args = parser.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)

    images, labels, forms = load_cache()
    _, test_mask = split_by_writer(forms)
    x = to_float(images[test_mask])
    y = labels[test_mask]
    writers = len(np.unique(forms[test_mask]))

    model = load_verified_model_bn()
    report: dict = {
        "dataset": f"BanglaLekha-Isolated, held-out writers ({writers} forms, 15% by-writer split, seed 20261017)",
        "samples": int(len(y)),
        "classes": BENGALI_LABELS,
        "evaluated_on": date.today().isoformat(),
        "torch": torch.__version__,
        "models": {},
        "reference": "onnx fp32 (bn_cnn.onnx)",
    }
    print(f"[evaluate_bn] PyTorch on {len(y)} samples from {writers} unseen writer forms ...")
    report["models"]["pytorch (bn_cnn.pth)"] = metrics(torch_logits(model, x), y, BENGALI_LABELS)

    import onnxruntime as ort

    report["onnxruntime"] = ort.__version__
    for name in sorted(f for f in os.listdir(SAVED) if f.startswith("bn_cnn") and f.endswith(".onnx")):
        key = f"onnx {'int8' if 'int8' in name else 'fp32'} ({name})"
        print(f"[evaluate_bn] {key} ...")
        session = ort.InferenceSession(os.path.join(SAVED, name), providers=["CPUExecutionProvider"])
        report["models"][key] = metrics(onnx_logits(session, x), y, BENGALI_LABELS)
    if report["reference"] not in report["models"]:
        report["reference"] = next(iter(report["models"]))

    ref = report["models"][report["reference"]]
    png = os.path.join(args.out, "confusion-matrix-bengali.png")
    save_confusion_png(np.array(ref["confusion_matrix"]), png, f"BanglaLekha-Isolated, unseen writers — {report['reference']} — top-1 {ref['top1'] * 100:.2f}%", BENGALI_LABELS)
    import json

    with open(os.path.join(args.out, "accuracy-bengali.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(report, fh, indent=1, ensure_ascii=False)
    print()
    print(markdown_summary(report))
    print(f"\n[evaluate_bn] wrote {os.path.join(args.out, 'accuracy-bengali.json')} and {png}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
