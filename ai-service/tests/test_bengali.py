"""
The Bengali recogniser: label set, architecture contract, and (when the
trained weights and exports are committed) their checksums and agreement.
"""

from __future__ import annotations

import os
import unicodedata

import numpy as np
import pytest
import torch

from model_bn import BENGALI_LABELS, COMPOUNDS, CONSONANTS, DIGITS, MODEL_PATH_BN, NUM_CLASSES_BN, VOWELS, BengaliCNN
from model_loader import _sha256_of

SAVED = os.path.dirname(MODEL_PATH_BN)
ONNX_BN = os.path.join(SAVED, "bn_cnn.onnx")
ONNX_BN_INT8 = os.path.join(SAVED, "bn_cnn.int8.onnx")


def test_label_set_matches_the_dataset_layout():
    assert len(VOWELS) == 11
    assert len(CONSONANTS) == 39
    assert len(DIGITS) == 10
    assert len(COMPOUNDS) == 24
    assert NUM_CLASSES_BN == 84
    assert len(set(BENGALI_LABELS)) == 84, "duplicate label"
    for label in BENGALI_LABELS:
        assert all(0x0980 <= ord(ch) <= 0x09FF for ch in label), f"{label!r} is not Bengali"
        assert unicodedata.normalize("NFC", label) == label


def test_compounds_are_conjuncts_with_a_hasanta():
    for label in COMPOUNDS:
        assert "্" in label, f"{label!r} has no virama"


def test_model_contract():
    model = BengaliCNN()
    model.eval()
    with torch.no_grad():
        out = model(torch.zeros(3, 1, 28, 28))
    assert out.shape == (3, NUM_CLASSES_BN)


@pytest.mark.skipif(not os.path.exists(MODEL_PATH_BN), reason="bn_cnn.pth not trained yet")
def test_weights_match_pinned_checksum_and_load():
    with open(os.path.splitext(MODEL_PATH_BN)[0] + ".sha256", "r", encoding="utf-8") as fh:
        expected = fh.read().split()[0]
    assert _sha256_of(MODEL_PATH_BN) == expected
    model = BengaliCNN()
    model.load_state_dict(torch.load(MODEL_PATH_BN, map_location="cpu", weights_only=True), strict=True)


@pytest.mark.skipif(not os.path.exists(ONNX_BN), reason="bn_cnn.onnx not exported yet")
def test_onnx_matches_pytorch_on_random_inputs():
    import onnxruntime as ort

    from export_onnx import onnx_logits, torch_logits
    from export_onnx_bn import load_verified_model_bn

    model = load_verified_model_bn()
    rng = np.random.default_rng(7)
    images = rng.random((256, 1, 28, 28), dtype=np.float32)
    a = torch_logits(model, images)
    for path, tol, min_agree in ((ONNX_BN, 1e-4, 1.0), (ONNX_BN_INT8, 1.0, 0.95)):
        if not os.path.exists(path):
            continue
        b = onnx_logits(ort.InferenceSession(path, providers=["CPUExecutionProvider"]), images)
        assert np.abs(a - b).max() < tol
        assert (a.argmax(1) == b.argmax(1)).mean() >= min_agree
