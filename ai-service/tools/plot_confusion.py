"""
Plot the confusion matrix stored in an accuracy report.

    python tools/plot_confusion.py ../docs/accuracy-real-strokes.json
    python tools/plot_confusion.py ../docs/accuracy-emnist.json --model "onnx int8 (emnist_cnn.int8.onnx)"

Writes <report-stem>.png next to the report (e.g. docs/confusion-matrix-real-strokes.png
for docs/accuracy-real-strokes.json). The report is whatever evaluate.py or
client/scripts/evaluate-real-strokes.ts produced; nothing is recomputed here.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from evaluate import save_confusion_png  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("report", help="accuracy-*.json written by an evaluator")
    parser.add_argument("--model", default=None, help="which entry under 'models' to plot (default: the report's reference)")
    args = parser.parse_args(argv)

    with open(args.report, "r", encoding="utf-8") as fh:
        report = json.load(fh)
    key = args.model or report["reference"]
    m = report["models"][key]
    stem = os.path.basename(args.report).replace("accuracy-", "confusion-matrix-").rsplit(".", 1)[0]
    out = os.path.join(os.path.dirname(os.path.abspath(args.report)), stem + ".png")
    title = f"{report.get('dataset', '')} — {key} — top-1 {m['top1'] * 100:.2f}% ({m['samples']} samples)"
    save_confusion_png(np.array(m["confusion_matrix"]), out, title)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
