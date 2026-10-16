"""
The committed ONNX export must be the checksummed CharCNN, nothing else.

- The .onnx file matches its pinned .sha256.
- The graph contract is (batch, 1, 28, 28) float32 -> (batch, 47) logits.
- PyTorch and ONNX Runtime agree on random inputs (always runs).
- On the EMNIST Balanced test split, top-1 predictions agree on at least
  99.9% of samples and the max logit difference is reported (needs the data
  on disk; see emnist_data.py).
- If an int8 copy is committed, its EMNIST top-1 may trail fp32 by at most
  0.5 percentage points.
"""

from __future__ import annotations

import os

import numpy as np
import onnxruntime as ort
import pytest

from emnist_data import is_available, load_split
from export_onnx import ONNX_INT8_PATH, ONNX_PATH, load_verified_model, onnx_logits, read_checksum, torch_logits
from model_loader import _sha256_of

MIN_TOP1_AGREEMENT = 0.999
MAX_LOGIT_DIFF = 1e-3
INT8_MAX_TOP1_DROP = 0.005

COMMITTED = [p for p in (ONNX_PATH, ONNX_INT8_PATH) if os.path.exists(p)]
needs_emnist = pytest.mark.skipif(
    not is_available("test"),
    reason="EMNIST Balanced test split not on disk (run train.py once or set AIRSCRIPT_EMNIST_DIR)",
)


@pytest.fixture(scope="module")
def model():
    return load_verified_model()


@pytest.fixture(scope="module")
def emnist_test():
    return load_split("test")


def _session(path: str) -> ort.InferenceSession:
    return ort.InferenceSession(path, providers=["CPUExecutionProvider"])


def test_fp32_onnx_is_committed():
    assert os.path.exists(ONNX_PATH), "run `python export_onnx.py` and commit saved_model/emnist_cnn.onnx"


@pytest.mark.parametrize("path", COMMITTED, ids=os.path.basename)
def test_onnx_matches_pinned_checksum(path):
    expected = read_checksum(path)
    assert expected, f"missing {path}.sha256"
    assert _sha256_of(path) == expected


@pytest.mark.parametrize("path", COMMITTED, ids=os.path.basename)
def test_onnx_graph_contract(path):
    session = _session(path)
    (inp,) = session.get_inputs()
    (out,) = session.get_outputs()
    assert inp.name == "image"
    assert inp.type == "tensor(float)"
    assert inp.shape[1:] == [1, 28, 28]
    assert out.name == "logits"
    assert out.shape[1:] == [47]
    # Batch is dynamic: one sample and a handful must both run.
    for n in (1, 5):
        logits = session.run(["logits"], {"image": np.zeros((n, 1, 28, 28), np.float32)})[0]
        assert logits.shape == (n, 47)


def test_fp32_onnx_matches_pytorch_on_random_inputs(model):
    rng = np.random.default_rng(1234)
    images = rng.random((512, 1, 28, 28), dtype=np.float32)
    a = torch_logits(model, images)
    b = onnx_logits(_session(ONNX_PATH), images)
    assert np.abs(a - b).max() < 1e-4
    assert (a.argmax(1) == b.argmax(1)).all()


@needs_emnist
def test_fp32_onnx_matches_pytorch_on_emnist_test_split(model, emnist_test):
    images, labels = emnist_test
    a = torch_logits(model, images)
    b = onnx_logits(_session(ONNX_PATH), images)
    max_diff = float(np.abs(a - b).max())
    agreement = float((a.argmax(1) == b.argmax(1)).mean())
    top1_torch = float((a.argmax(1) == labels).mean())
    top1_onnx = float((b.argmax(1) == labels).mean())
    print(
        f"\nEMNIST Balanced test ({len(images)} samples): max |logit diff| = {max_diff:.3e}, "
        f"top-1 agreement = {agreement:.5f}, top-1 PyTorch = {top1_torch:.4f}, top-1 ONNX = {top1_onnx:.4f}"
    )
    assert agreement >= MIN_TOP1_AGREEMENT
    assert max_diff < MAX_LOGIT_DIFF


@needs_emnist
@pytest.mark.skipif(not os.path.exists(ONNX_INT8_PATH), reason="no int8 export committed")
def test_int8_onnx_top1_within_half_a_point_of_fp32(emnist_test):
    images, labels = emnist_test
    fp32 = float((onnx_logits(_session(ONNX_PATH), images).argmax(1) == labels).mean())
    int8 = float((onnx_logits(_session(ONNX_INT8_PATH), images).argmax(1) == labels).mean())
    print(f"\nEMNIST Balanced test top-1: fp32 = {fp32:.4f}, int8 = {int8:.4f}, drop = {(fp32 - int8) * 100:.2f} pp")
    assert fp32 - int8 <= INT8_MAX_TOP1_DROP
