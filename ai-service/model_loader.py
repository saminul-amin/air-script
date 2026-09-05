"""
model_loader.py — Singleton model loading with CPU optimization.

Loads the trained EMNIST CharCNN once, applies torch.jit.trace for
faster CPU inference, and exposes it as a module-level singleton.

Loading is strict: if the weights file is missing, cannot be read, or
does not match the pinned checksum, ``get_model()`` raises
``ModelNotReadyError``. The service never silently serves predictions
from a randomly initialised network.

Where the weights come from (first match wins):
    1. ``AIRSCRIPT_MODEL_PATH`` env var, else ``saved_model/emnist_cnn.pth``
    2. If that file is absent and ``AIRSCRIPT_MODEL_URL`` is set, the file
       is downloaded there once at startup.
    3. Otherwise loading fails loudly.

A ``saved_model/emnist_cnn.sha256`` file, if present, pins the expected
checksum so a wrong or corrupted file is rejected rather than served.
"""

from __future__ import annotations

import hashlib
import os
import threading
import urllib.request

import torch

from model import CharCNN

_HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.path.join(_HERE, "saved_model", "emnist_cnn.pth")
MODEL_PATH = os.environ.get("AIRSCRIPT_MODEL_PATH") or DEFAULT_MODEL_PATH
MODEL_URL = os.environ.get("AIRSCRIPT_MODEL_URL", "").strip()
CHECKSUM_PATH = os.path.splitext(MODEL_PATH)[0] + ".sha256"

NUM_CLASSES = 47

# EMNIST-balanced class mapping (47 classes)
EMNIST_LABELS = (
    list("0123456789")
    + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    + list("abdefghnqrt")
)
assert len(EMNIST_LABELS) == NUM_CLASSES


class ModelNotReadyError(RuntimeError):
    """Raised when trained weights are unavailable or invalid."""


_lock = threading.Lock()
_traced_model: torch.jit.ScriptModule | None = None
_status: dict = {
    "loaded": False,
    "path": MODEL_PATH,
    "sha256": None,
    "expected_sha256": None,
    "num_classes": NUM_CLASSES,
    "error": None,
}


def _read_expected_checksum() -> str | None:
    env = os.environ.get("AIRSCRIPT_MODEL_SHA256", "").strip().lower()
    if env:
        return env
    if os.path.exists(CHECKSUM_PATH):
        with open(CHECKSUM_PATH, "r", encoding="utf-8") as fh:
            first = fh.read().strip().split()
            if first:
                return first[0].lower()
    return None


def _sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_weights(url: str, dest: str) -> None:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    print(f"[model_loader] Downloading weights from {url}")
    with urllib.request.urlopen(url, timeout=120) as resp, open(tmp, "wb") as out:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    os.replace(tmp, dest)


def _load_locked() -> torch.jit.ScriptModule:
    global _traced_model

    if _traced_model is not None:
        return _traced_model

    expected = _read_expected_checksum()
    _status["expected_sha256"] = expected

    if not os.path.exists(MODEL_PATH):
        if MODEL_URL:
            try:
                _download_weights(MODEL_URL, MODEL_PATH)
            except Exception as exc:  # noqa: BLE001 — surface any download failure
                raise ModelNotReadyError(
                    f"Could not download model weights from {MODEL_URL}: {exc}"
                ) from exc
        else:
            raise ModelNotReadyError(
                f"Trained weights not found at {MODEL_PATH}. "
                "Run `python train.py`, commit saved_model/emnist_cnn.pth, "
                "or set AIRSCRIPT_MODEL_URL to a downloadable .pth file."
            )

    actual = _sha256_of(MODEL_PATH)
    if expected and actual != expected:
        raise ModelNotReadyError(
            f"Weights checksum mismatch for {MODEL_PATH}: "
            f"expected {expected[:12]}…, got {actual[:12]}…. "
            "The file is not the trained checkpoint this service was built for."
        )

    model = CharCNN(num_classes=NUM_CLASSES)
    try:
        state = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
        model.load_state_dict(state, strict=True)
    except Exception as exc:  # noqa: BLE001 — any load failure is fatal
        raise ModelNotReadyError(
            f"Weights at {MODEL_PATH} could not be loaded into CharCNN: {exc}"
        ) from exc
    model.eval()

    dummy = torch.randn(1, 1, 28, 28)
    with torch.no_grad():
        traced = torch.jit.trace(model, dummy)
    traced.eval()

    _traced_model = traced
    _status.update({"loaded": True, "sha256": actual, "error": None})
    print(f"[model_loader] Loaded weights from {MODEL_PATH} (sha256 {actual[:12]}…)")
    print("[model_loader] Model traced with TorchScript for fast CPU inference")
    return traced


def get_model() -> torch.jit.ScriptModule:
    """Return the traced model, loading it on first call. Raises ModelNotReadyError."""
    with _lock:
        try:
            return _load_locked()
        except ModelNotReadyError as exc:
            _status.update({"loaded": False, "error": str(exc)})
            raise


def try_load_model() -> bool:
    """Attempt to load; return True on success, False (with status recorded) otherwise."""
    try:
        get_model()
        return True
    except ModelNotReadyError as exc:
        print(f"[model_loader] ERROR: {exc}")
        return False


def get_model_status() -> dict:
    """Snapshot of the loader state for the /health endpoint."""
    with _lock:
        return dict(_status)


def is_model_loaded() -> bool:
    return bool(_status["loaded"])
