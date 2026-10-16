"""
emnist_data.py — Read the EMNIST Balanced IDX files directly, no torchvision needed.

train.py downloads EMNIST through torchvision into ``data/EMNIST/raw``. The
evaluation and export checks only need the test split, so they read the raw
IDX files with NumPy and apply the same orientation fix as ``train.py``
(EMNIST images are stored transposed; ``TransposeTransform`` swaps H and W).

Set ``AIRSCRIPT_EMNIST_DIR`` to point at another directory holding the
``emnist-balanced-*-ubyte`` files.
"""

from __future__ import annotations

import os
import struct

import numpy as np

_HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DIR = os.path.join(_HERE, "data", "EMNIST", "raw")
EMNIST_DIR = os.environ.get("AIRSCRIPT_EMNIST_DIR") or DEFAULT_DIR

NUM_CLASSES = 47
IMAGE_SIZE = 28


class EmnistNotAvailable(FileNotFoundError):
    """Raised when the EMNIST Balanced files are not on disk."""


def _paths(split: str) -> tuple[str, str]:
    if split not in ("train", "test"):
        raise ValueError(f"split must be 'train' or 'test', got {split!r}")
    images = os.path.join(EMNIST_DIR, f"emnist-balanced-{split}-images-idx3-ubyte")
    labels = os.path.join(EMNIST_DIR, f"emnist-balanced-{split}-labels-idx1-ubyte")
    return images, labels


def is_available(split: str = "test") -> bool:
    images, labels = _paths(split)
    return os.path.exists(images) and os.path.exists(labels)


def _read_idx(path: str, expected_magic: int) -> np.ndarray:
    with open(path, "rb") as fh:
        magic, count = struct.unpack(">II", fh.read(8))
        if magic != expected_magic:
            raise ValueError(f"{path}: bad IDX magic {magic:#x}, expected {expected_magic:#x}")
        if expected_magic == 2051:
            rows, cols = struct.unpack(">II", fh.read(8))
            data = np.frombuffer(fh.read(count * rows * cols), dtype=np.uint8)
            return data.reshape(count, rows, cols)
        data = np.frombuffer(fh.read(count), dtype=np.uint8)
        return data.reshape(count)


def load_split(split: str = "test") -> tuple[np.ndarray, np.ndarray]:
    """
    Return ``(images, labels)`` for an EMNIST Balanced split.

    ``images`` is float32 of shape ``(N, 1, 28, 28)`` in [0, 1], oriented the
    way ``train.py`` fed them to the network. ``labels`` is int64 of shape ``(N,)``.
    """
    images_path, labels_path = _paths(split)
    if not (os.path.exists(images_path) and os.path.exists(labels_path)):
        raise EmnistNotAvailable(
            f"EMNIST Balanced {split} split not found in {EMNIST_DIR}. "
            "Run `python train.py` once (downloads ~2 GB via torchvision), or set "
            "AIRSCRIPT_EMNIST_DIR to a directory holding the emnist-balanced-*-ubyte files."
        )
    raw = _read_idx(images_path, 2051)
    labels = _read_idx(labels_path, 2049).astype(np.int64)
    if raw.shape[1:] != (IMAGE_SIZE, IMAGE_SIZE):
        raise ValueError(f"unexpected EMNIST image shape {raw.shape[1:]}")
    # ToTensor() -> (1, 28, 28) in [0, 1]; TransposeTransform -> permute(0, 2, 1)
    images = raw.astype(np.float32) / 255.0
    images = np.ascontiguousarray(images.transpose(0, 2, 1))[:, None, :, :]
    return images, labels
