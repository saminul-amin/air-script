"""
evaluate.py — Measure the character recogniser on the EMNIST Balanced test split.

Usage:
    cd ai-service
    pip install -r requirements-export.txt
    python evaluate.py                      # PyTorch + every committed ONNX export
    python evaluate.py --out ../docs        # where the report and the image go (default)

For PyTorch (the checksummed .pth in the unchanged CharCNN) and for each ONNX
file in saved_model/, this reports on all 18,800 test samples:

    top-1 and top-3 accuracy, per-class accuracy, the ten most confused
    (true, predicted) pairs, and a confusion-matrix image.

Outputs (never hand-edited; the README quotes them):
    <out>/accuracy-emnist.json             all numbers, machine readable
    <out>/confusion-matrix-emnist.png      47x47 matrix for the fp32 ONNX export
    stdout                                 a Markdown summary to paste into the README

EMNIST Balanced merges several lowercase letters into their uppercase class
(c, i, j, k, l, m, o, p, s, u, v, w, x, y, z), so the remaining confusions are
the shapes the dataset itself cannot separate: O/0, I/l/1, S/5, Z/2, q/9 ...
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date

import numpy as np
import torch

from emnist_data import load_split
from export_onnx import SAVED, load_verified_model, onnx_logits, torch_logits
from model_loader import EMNIST_LABELS

_HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.normpath(os.path.join(_HERE, "..", "docs"))
TOP_K = 3
MOST_CONFUSED = 10


def metrics(logits: np.ndarray, labels: np.ndarray, class_names: list[str] = EMNIST_LABELS) -> dict:
    n_classes = len(class_names)
    pred = logits.argmax(1)
    topk = np.argsort(-logits, axis=1)[:, :TOP_K]
    top1 = float((pred == labels).mean())
    top3 = float((topk == labels[:, None]).any(axis=1).mean())

    confusion = np.zeros((n_classes, n_classes), dtype=np.int64)
    np.add.at(confusion, (labels, pred), 1)
    per_class = {
        class_names[c]: {
            "support": int(confusion[c].sum()),
            "accuracy": float(confusion[c, c] / confusion[c].sum()) if confusion[c].sum() else None,
        }
        for c in range(n_classes)
    }

    off = confusion.copy()
    np.fill_diagonal(off, 0)
    flat = np.argsort(-off, axis=None)[:MOST_CONFUSED]
    most_confused = []
    for idx in flat:
        t, p = np.unravel_index(idx, off.shape)
        if off[t, p] == 0:
            break
        most_confused.append(
            {
                "true": class_names[t],
                "predicted": class_names[p],
                "count": int(off[t, p]),
                "share_of_true_class": float(off[t, p] / confusion[t].sum()),
            }
        )
    return {
        "samples": int(len(labels)),
        "top1": top1,
        "top3": top3,
        "per_class": per_class,
        "most_confused": most_confused,
        "confusion_matrix": confusion.tolist(),
    }


def save_confusion_png(confusion: np.ndarray, path: str, title: str, class_names: list[str] = EMNIST_LABELS) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    n = len(class_names)
    # Bengali labels need a font with Bengali glyphs; DejaVu (matplotlib's default) has none.
    font = None
    if any(ord(ch) > 0x0980 for name in class_names for ch in name):
        for candidate in ("C:/Windows/Fonts/Nirmala.ttf", "C:/Windows/Fonts/vrinda.ttf", "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf"):
            if os.path.exists(candidate):
                font = font_manager.FontProperties(fname=candidate, size=8)
                break
    row_norm = confusion / np.maximum(confusion.sum(axis=1, keepdims=True), 1)
    fig, ax = plt.subplots(figsize=(13, 12), dpi=110)
    # Log-ish scale so the off-diagonal confusions are visible next to a ~90% diagonal.
    shown = np.log10(row_norm * 100 + 1)
    im = ax.imshow(shown, cmap="magma", interpolation="nearest")
    ax.set_xticks(range(n))
    ax.set_yticks(range(n))
    if font is not None:
        ax.set_xticklabels(class_names, fontproperties=font, rotation=90)
        ax.set_yticklabels(class_names, fontproperties=font)
    else:
        ax.set_xticklabels(class_names, fontsize=8, family="monospace")
        ax.set_yticklabels(class_names, fontsize=8, family="monospace")
    ax.set_xlabel("predicted")
    ax.set_ylabel("true")
    ax.set_title(title)
    for t in range(n):
        for p in range(n):
            if t != p and row_norm[t, p] >= 0.02:
                ax.text(p, t, f"{row_norm[t, p] * 100:.0f}", ha="center", va="center", fontsize=6, color="white")
    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cbar.set_label("row-normalised %, log scale")
    cbar.set_ticks([np.log10(v + 1) for v in (0, 1, 5, 20, 50, 100)])
    cbar.set_ticklabels(["0", "1", "5", "20", "50", "100"])
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def markdown_summary(report: dict) -> str:
    lines = ["| Model | Top-1 | Top-3 |", "|---|---|---|"]
    for name, m in report["models"].items():
        lines.append(f"| {name} | {m['top1'] * 100:.2f}% | {m['top3'] * 100:.2f}% |")
    ref = report["models"][report["reference"]]
    lines.append("")
    lines.append(f"Most confused pairs ({report['reference']}, true → predicted, share of the true class):")
    lines.append("")
    for c in ref["most_confused"]:
        lines.append(f"- `{c['true']}` → `{c['predicted']}`: {c['count']} ({c['share_of_true_class'] * 100:.1f}%)")
    worst = sorted(((k, v["accuracy"]) for k, v in ref["per_class"].items() if v["accuracy"] is not None), key=lambda kv: kv[1])[:5]
    lines.append("")
    lines.append("Weakest classes: " + ", ".join(f"`{k}` {a * 100:.1f}%" for k, a in worst))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=DEFAULT_OUT, help="directory for accuracy-emnist.json and the confusion matrix PNG")
    args = parser.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)

    images, labels = load_split("test")
    model = load_verified_model()
    report: dict = {
        "dataset": "EMNIST Balanced, test split",
        "samples": int(len(labels)),
        "classes": EMNIST_LABELS,
        "evaluated_on": date.today().isoformat(),
        "torch": torch.__version__,
        "models": {},
        "reference": "onnx fp32 (emnist_cnn.onnx)",
    }

    print(f"[evaluate] PyTorch on {len(labels)} samples ...")
    report["models"]["pytorch (emnist_cnn.pth)"] = metrics(torch_logits(model, images), labels)

    import onnxruntime as ort

    report["onnxruntime"] = ort.__version__
    for name in sorted(f for f in os.listdir(SAVED) if f.endswith(".onnx")):
        key = f"onnx {'int8' if 'int8' in name else 'fp32'} ({name})"
        print(f"[evaluate] {key} ...")
        session = ort.InferenceSession(os.path.join(SAVED, name), providers=["CPUExecutionProvider"])
        report["models"][key] = metrics(onnx_logits(session, images), labels)

    if report["reference"] not in report["models"]:
        report["reference"] = next(iter(report["models"]))

    ref = report["models"][report["reference"]]
    png = os.path.join(args.out, "confusion-matrix-emnist.png")
    save_confusion_png(np.array(ref["confusion_matrix"]), png, f"EMNIST Balanced test — {report['reference']} — top-1 {ref['top1'] * 100:.2f}%")

    with open(os.path.join(args.out, "accuracy-emnist.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(report, fh, indent=1)

    print()
    print(markdown_summary(report))
    print()
    print(f"[evaluate] wrote {os.path.join(args.out, 'accuracy-emnist.json')} and {png}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
