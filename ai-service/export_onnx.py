"""
export_onnx.py — Export the checksummed CharCNN weights to ONNX.

Usage:
    cd ai-service
    python export_onnx.py                # writes saved_model/emnist_cnn.onnx (+ .sha256)
    python export_onnx.py --quantize     # also writes saved_model/emnist_cnn.int8.onnx (+ .sha256)

The ``.pth`` is verified against ``saved_model/emnist_cnn.sha256`` before it is
loaded into the *unchanged* ``CharCNN`` from ``model.py``. The graph has one
input ``image`` of shape ``(batch, 1, 28, 28)`` (float32, [0, 1], white on black,
exactly what ``preprocessing.py`` produces) and one output ``logits`` of shape
``(batch, 47)``. Softmax is left to the caller, as in ``predict.py``.

After writing, the script runs the ONNX file with onnxruntime on a random batch
and on the EMNIST Balanced test split when it is on disk, and prints the
maximum absolute logit difference and the top-1 agreement with PyTorch. The
authoritative check is ``tests/test_onnx_export.py``.
"""

from __future__ import annotations

import argparse
import os
import sys

import numpy as np
import torch

from model import CharCNN
from model_loader import DEFAULT_MODEL_PATH, NUM_CLASSES, _read_expected_checksum, _sha256_of

_HERE = os.path.dirname(os.path.abspath(__file__))
SAVED = os.path.join(_HERE, "saved_model")
ONNX_PATH = os.path.join(SAVED, "emnist_cnn.onnx")
ONNX_INT8_PATH = os.path.join(SAVED, "emnist_cnn.int8.onnx")
OPSET = 17


def checksum_path(path: str) -> str:
    return path + ".sha256"


def write_checksum(path: str) -> str:
    digest = _sha256_of(path)
    with open(checksum_path(path), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"{digest}  {os.path.basename(path)}\n")
    return digest


def read_checksum(path: str) -> str | None:
    cp = checksum_path(path)
    if not os.path.exists(cp):
        return None
    with open(cp, "r", encoding="utf-8") as fh:
        parts = fh.read().strip().split()
    return parts[0].lower() if parts else None


def load_verified_model(pth_path: str = DEFAULT_MODEL_PATH) -> CharCNN:
    """Load the trained weights only if they match the pinned checksum."""
    expected = _read_expected_checksum()
    actual = _sha256_of(pth_path)
    if expected is None:
        raise RuntimeError(f"No pinned checksum next to {pth_path}; refusing to export unverified weights.")
    if actual != expected:
        raise RuntimeError(f"Checksum mismatch for {pth_path}: expected {expected[:12]}..., got {actual[:12]}...")
    model = CharCNN(num_classes=NUM_CLASSES)
    state = torch.load(pth_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state, strict=True)
    model.eval()
    return model


def export(model: CharCNN, out_path: str = ONNX_PATH) -> str:
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    dummy = torch.zeros(2, 1, 28, 28, dtype=torch.float32)
    batch = torch.export.Dim("batch", min=1)
    with torch.no_grad():
        program = torch.onnx.export(
            model,
            (dummy,),
            input_names=["image"],
            output_names=["logits"],
            opset_version=OPSET,
            dynamic_shapes={"x": {0: batch}},
            dynamo=True,
            external_data=False,
            verbose=False,  # the exporter's progress lines use emoji that cp1252 consoles cannot print
        )
    program.save(out_path, external_data=False)
    return out_path


def quantize(fp32_path: str = ONNX_PATH, out_path: str = ONNX_INT8_PATH) -> str:
    """Dynamic int8 quantisation of the weight matrices."""
    import tempfile

    import onnx
    from onnxruntime.quantization import QuantType, quantize_dynamic

    # The dynamo exporter lists every initializer in value_info. The quantizer
    # transposes Gemm weights in place and then runs strict shape inference, so
    # those stale annotations make it fail. Drop them from a temporary copy.
    model = onnx.load(fp32_path)
    initializer_names = {init.name for init in model.graph.initializer}
    kept = [vi for vi in model.graph.value_info if vi.name not in initializer_names]
    del model.graph.value_info[:]
    model.graph.value_info.extend(kept)
    with tempfile.TemporaryDirectory() as tmp:
        clean = os.path.join(tmp, "fp32.onnx")
        onnx.save(model, clean)
        quantize_dynamic(clean, out_path, weight_type=QuantType.QInt8)
    return out_path


def onnx_logits(session, images: np.ndarray, batch_size: int = 1024) -> np.ndarray:
    return np.concatenate(
        [session.run(["logits"], {"image": images[i : i + batch_size]})[0] for i in range(0, len(images), batch_size)]
    )


def torch_logits(model: CharCNN, images: np.ndarray, batch_size: int = 1024) -> np.ndarray:
    with torch.no_grad():
        return np.concatenate(
            [model(torch.from_numpy(images[i : i + batch_size])).numpy() for i in range(0, len(images), batch_size)]
        )


def compare(model: CharCNN, onnx_path: str, images: np.ndarray) -> tuple[float, float]:
    """Return (max |logit diff|, top-1 agreement ratio) between PyTorch and ONNX."""
    import onnxruntime as ort

    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    a = torch_logits(model, images)
    b = onnx_logits(session, images)
    return float(np.abs(a - b).max()), float((a.argmax(1) == b.argmax(1)).mean())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--quantize", action="store_true", help="also write an int8 dynamically quantised copy")
    parser.add_argument("--out", default=ONNX_PATH, help="output path for the fp32 ONNX file")
    args = parser.parse_args(argv)

    model = load_verified_model()
    out = export(model, args.out)
    digest = write_checksum(out)
    print(f"[export] wrote {out} ({os.path.getsize(out) / 1e6:.2f} MB, sha256 {digest[:12]}...)")

    outputs = [out]
    if args.quantize:
        q = quantize(out)
        qdigest = write_checksum(q)
        print(f"[export] wrote {q} ({os.path.getsize(q) / 1e6:.2f} MB, sha256 {qdigest[:12]}...)")
        outputs.append(q)

    rng = np.random.default_rng(0)
    random_batch = rng.random((256, 1, 28, 28), dtype=np.float32)
    for path in outputs:
        diff, agreement = compare(model, path, random_batch)
        print(
            f"[export] {os.path.basename(path)} vs PyTorch on 256 random inputs: "
            f"max |dlogit| = {diff:.3e}, top-1 agreement = {agreement:.4f}"
        )

    try:
        from emnist_data import load_split

        images, labels = load_split("test")
    except FileNotFoundError as exc:
        print(f"[export] EMNIST test split not available, skipping accuracy report: {exc}")
        return 0

    ref = torch_logits(model, images).argmax(1)
    print(f"[export] PyTorch top-1 on EMNIST Balanced test ({len(images)} samples): {(ref == labels).mean():.4f}")
    import onnxruntime as ort

    for path in outputs:
        diff, agreement = compare(model, path, images)
        session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        pred = onnx_logits(session, images).argmax(1)
        print(
            f"[export] {os.path.basename(path)}: top-1 {(pred == labels).mean():.4f}, "
            f"agreement with PyTorch {agreement:.4f}, max |dlogit| {diff:.3e}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
