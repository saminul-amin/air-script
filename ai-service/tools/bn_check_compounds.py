"""
Cross-check the compound-character mapping in model_bn.py with the trained model.

Renders candidate conjuncts with a Bengali system font (through the client's
@napi-rs/canvas, which shapes Indic text), pushes each rendering through the
unchanged app preprocessing and the trained Bengali ONNX model, and prints
which dataset class the model assigns to each printed glyph. A candidate that
lands on the class it is mapped to supports the mapping; one that lands
elsewhere says "look again". Printed and handwritten shapes differ, so this
is evidence, not proof.

    python tools/bn_check_compounds.py
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SERVICE = os.path.dirname(HERE)
CLIENT = os.path.normpath(os.path.join(SERVICE, "..", "client"))
sys.path.insert(0, SERVICE)

from model_bn import BENGALI_LABELS, COMPOUNDS  # noqa: E402
from preprocessing import preprocess_image  # noqa: E402

CANDIDATES = (
    "ক্ষ ক্ত ক্র ঙ্ক ঙ্গ চ্চ চ্ছ জ্জ জ্ঞ ঞ্চ ঞ্ছ ঞ্জ ট্ট ণ্ট ণ্ড ত্ত ত্থ ত্র দ্দ দ্ধ দ্ব ন্ট ন্ঠ ন্ত ন্থ ন্দ ন্ধ ন্ন "
    "প্ত প্প ব্দ ব্ধ ম্প ম্ব ম্ভ ম্ম ল্ল ল্প শ্চ ষ্ট ষ্ঠ ষ্ণ স্ক স্ত স্থ স্ন স্প স্ম হ্ন ক্ষ্ম গ্ধ ত্ম ন্স ল্ক ষ্প হ্ম ঙ্ক্ষ ত্ন গ্ন ন্ম ল্ম শ্ন স্ল ক্ল ষ্ক ষ্ম ক্ক গ্গ জ্ব দ্ম ব্ব ভ্র শ্ম স্ব ল্ব ত্ব ন্ড ণ্ণ"
).split()

RENDER_JS = r"""
const { createCanvas, GlobalFonts } = require(process.argv[2]);
const fs = require("fs");
const [,, , outDir, fontPath, ...texts] = process.argv;
GlobalFonts.registerFromPath(fontPath, "BN");
texts.forEach((t, i) => {
  const cv = createCanvas(640, 480); const ctx = cv.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.font = "240px BN"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.lineWidth = 10; ctx.strokeStyle = "#fff"; ctx.strokeText(t, 320, 250); ctx.fillText(t, 320, 250);
  fs.writeFileSync(`${outDir}/${i}.png`, cv.toBuffer("image/png"));
});
"""


def render(out_dir: str, texts: list[str]) -> None:
    font = os.environ.get("AIRSCRIPT_BN_FONT") or next(p for p in ("C:/Windows/Fonts/Nirmala.ttc", "C:/Windows/Fonts/vrinda.ttf") if os.path.exists(p))
    script = os.path.join(out_dir, "render.cjs")
    with open(script, "w", encoding="utf-8") as fh:
        fh.write(RENDER_JS)
    canvas_pkg = os.path.join(CLIENT, "node_modules", "@napi-rs", "canvas")
    subprocess.run(["node", script, canvas_pkg, out_dir, font, *texts], check=True)


def main() -> int:
    import onnxruntime as ort

    session = ort.InferenceSession(os.path.join(SERVICE, "saved_model", "bn_cnn.onnx"), providers=["CPUExecutionProvider"])
    with tempfile.TemporaryDirectory() as tmp:
        render(tmp, CANDIDATES)
        inputs = []
        for i in range(len(CANDIDATES)):
            with open(os.path.join(tmp, f"{i}.png"), "rb") as fh:
                inputs.append(preprocess_image(fh.read()))
    x = np.stack(inputs)[:, None, :, :].astype(np.float32)
    logits = session.run(["logits"], {"image": x})[0]
    probs = np.exp(logits - logits.max(1, keepdims=True))
    probs /= probs.sum(1, keepdims=True)

    print("printed glyph → model's class (folder number, mapped label, probability)")
    hits = 0
    for i, cand in enumerate(CANDIDATES):
        order = np.argsort(-probs[i])[:3]
        top = ", ".join(f"{c + 1}:{BENGALI_LABELS[c]} {probs[i, c] * 100:.0f}%" for c in order)
        mapped = f"mapped to folder {61 + COMPOUNDS.index(cand)}" if cand in COMPOUNDS else "not in the mapping"
        agree = cand in COMPOUNDS and order[0] == 60 + COMPOUNDS.index(cand)
        hits += agree
        print(f"  {cand:6s} → {top}   [{mapped}{', agrees' if agree else ''}]")
    print(f"\n{hits}/24 mapped compounds: the printed glyph is classified into its own folder")
    print("\nper folder, the printed candidates the model sends there:")
    for k in range(24):
        sent = [CANDIDATES[i] for i in range(len(CANDIDATES)) if int(np.argmax(probs[i])) == 60 + k]
        print(f"  {61 + k} (mapped {COMPOUNDS[k]}): {' '.join(sent) if sent else '-'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
