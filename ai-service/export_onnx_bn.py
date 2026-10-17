"""
export_onnx_bn.py — Export the checksummed Bengali weights to ONNX.

    cd ai-service
    python export_onnx_bn.py --quantize    # saved_model/bn_cnn.onnx and bn_cnn.int8.onnx (+ .sha256 each)

Same contract as the English export: input ``image`` (batch, 1, 28, 28)
float32 in [0, 1], output ``logits`` (batch, 84). The ``.pth`` must match
``saved_model/bn_cnn.sha256``.
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import torch

from export_onnx import SAVED, compare, export, quantize, read_checksum, write_checksum
from model_bn import MODEL_PATH_BN, NUM_CLASSES_BN, BengaliCNN
from model_loader import _sha256_of

ONNX_PATH_BN = os.path.join(SAVED, "bn_cnn.onnx")
ONNX_INT8_PATH_BN = os.path.join(SAVED, "bn_cnn.int8.onnx")


def load_verified_model_bn(pth_path: str = MODEL_PATH_BN) -> BengaliCNN:
    expected = read_checksum(os.path.splitext(pth_path)[0])  # bn_cnn.sha256 sits next to bn_cnn.pth
    actual = _sha256_of(pth_path)
    if expected is None:
        raise RuntimeError(f"No pinned checksum next to {pth_path}; refusing to export unverified weights.")
    if actual != expected:
        raise RuntimeError(f"Checksum mismatch for {pth_path}: expected {expected[:12]}..., got {actual[:12]}...")
    model = BengaliCNN(num_classes=NUM_CLASSES_BN)
    model.load_state_dict(torch.load(pth_path, map_location="cpu", weights_only=True), strict=True)
    model.eval()
    return model


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--quantize", action="store_true")
    args = parser.parse_args(argv)

    model = load_verified_model_bn()
    out = export(model, ONNX_PATH_BN)
    print(f"[export_bn] wrote {out} ({os.path.getsize(out) / 1e6:.2f} MB, sha256 {write_checksum(out)[:12]}...)")
    outputs = [out]
    if args.quantize:
        q = quantize(out, ONNX_INT8_PATH_BN)
        print(f"[export_bn] wrote {q} ({os.path.getsize(q) / 1e6:.2f} MB, sha256 {write_checksum(q)[:12]}...)")
        outputs.append(q)

    rng = np.random.default_rng(0)
    batch = rng.random((256, 1, 28, 28), dtype=np.float32)
    for path in outputs:
        diff, agreement = compare(model, path, batch)
        print(f"[export_bn] {os.path.basename(path)} vs PyTorch on 256 random inputs: max |dlogit| = {diff:.3e}, top-1 agreement = {agreement:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
