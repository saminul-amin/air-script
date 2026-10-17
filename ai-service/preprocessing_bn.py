"""
preprocessing_bn.py — Turn BanglaLekha-Isolated images into training inputs.

The Bengali model is trained on exactly what the app's pipeline produces at
inference time: every dataset image goes through the unchanged
``preprocessing.preprocess_image`` (composite, blur, threshold, dilate, crop
with 20% padding, square, LANCZOS to 28×28, normalise). So there is no second
image pipeline to port or to keep in parity; the browser's TypeScript
preprocessing already matches it bit for bit.

BanglaLekha images are white characters on black, cropped and padded to a
square (Biswas et al., 2017). ``preprocess_image`` re-crops them to the
character's bounding box, which removes the dataset's own padding and leaves
the same 20% margin the app's strokes get.

The dataset lives outside the repo (``AIRSCRIPT_BN_DATA_DIR``); the processed
28×28 inputs are cached as uint8 in ``data/banglalekha/banglalekha_28.npz``
(git-ignored) so training and evaluation do not redo 166k PIL pipelines.
"""

from __future__ import annotations

import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np

from preprocessing import preprocess_image

_HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("AIRSCRIPT_BN_DATA_DIR") or os.path.join("E:", os.sep, "WorkBench", "datasets", "banglalekha-isolated", "extracted")
CACHE_DIR = os.path.join(_HERE, "data", "banglalekha")
CACHE_PATH = os.path.join(CACHE_DIR, "banglalekha_28.npz")
IMAGE_SIZE = 28

# <district>_<institution>_<gender>_<age>_<date>_<serial>_<class>.png
_NAME = re.compile(r"^(?P<form>\d+_\d+_\d+_\d+_\d+_\d+)_(?P<cls>\d+)\.(png|jpg|jpeg)$", re.IGNORECASE)


class BanglaLekhaNotAvailable(FileNotFoundError):
    """Raised when neither the cache nor the extracted dataset is on disk."""


def find_images_root(root: str = DATA_DIR) -> str:
    """The directory that holds the 84 class folders (1 … 84)."""
    for dirpath, dirnames, _ in os.walk(root):
        if "1" in dirnames and "84" in dirnames:
            return dirpath
    raise BanglaLekhaNotAvailable(f"No folder with class directories 1..84 under {root}; set AIRSCRIPT_BN_DATA_DIR")


def list_images(root: str = DATA_DIR) -> list[tuple[str, int, str]]:
    """(path, class index 0..83, form id) for every image, sorted for reproducibility."""
    base = find_images_root(root)
    items: list[tuple[str, int, str]] = []
    for cls in range(1, 85):
        folder = os.path.join(base, str(cls))
        if not os.path.isdir(folder):
            raise BanglaLekhaNotAvailable(f"missing class folder {folder}")
        for name in sorted(os.listdir(folder)):
            m = _NAME.match(name)
            if not m:
                continue
            items.append((os.path.join(folder, name), cls - 1, m.group("form")))
    return items


def _process(path: str) -> np.ndarray:
    with open(path, "rb") as fh:
        arr = preprocess_image(fh.read())
    if arr is None:
        return np.zeros((IMAGE_SIZE, IMAGE_SIZE), dtype=np.uint8)
    return np.rint(arr * 255).astype(np.uint8)


def build_cache(root: str = DATA_DIR, cache_path: str = CACHE_PATH, workers: int | None = None) -> str:
    items = list_images(root)
    print(f"[bn] preprocessing {len(items)} images from {root} with the app pipeline ...")
    paths = [p for p, _, _ in items]
    images = np.zeros((len(items), IMAGE_SIZE, IMAGE_SIZE), dtype=np.uint8)
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for i, arr in enumerate(pool.map(_process, paths, chunksize=256)):
            images[i] = arr
            if (i + 1) % 20000 == 0:
                print(f"[bn]   {i + 1}/{len(items)}")
    labels = np.array([c for _, c, _ in items], dtype=np.int64)
    forms = np.array([f for _, _, f in items])
    blank = int((images.reshape(len(items), -1).max(axis=1) == 0).sum())
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    np.savez_compressed(cache_path, images=images, labels=labels, forms=forms)
    print(f"[bn] cached {len(items)} inputs to {cache_path} ({blank} blank after preprocessing)")
    return cache_path


def load_cache(cache_path: str = CACHE_PATH) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(images uint8 (N, 28, 28), labels int64 (N,), form ids (N,))."""
    if not os.path.exists(cache_path):
        raise BanglaLekhaNotAvailable(f"{cache_path} not found; run `python preprocessing_bn.py` to build it from the dataset")
    with np.load(cache_path, allow_pickle=False) as z:
        return z["images"], z["labels"], z["forms"]


def split_by_writer(forms: np.ndarray, test_fraction: float = 0.15, seed: int = 20261017) -> tuple[np.ndarray, np.ndarray]:
    """
    Boolean masks (train, test). The split is by form id, so every image from
    a given handwriting form (one writer, one sitting) lands on one side:
    the test figure is for unseen writers, not unseen images.
    """
    unique = np.unique(forms)
    rng = np.random.default_rng(seed)
    rng.shuffle(unique)
    n_test = int(round(len(unique) * test_fraction))
    test_forms = set(unique[:n_test].tolist())
    test = np.array([f in test_forms for f in forms])
    return ~test, test


def to_float(images: np.ndarray) -> np.ndarray:
    """uint8 (N, 28, 28) → float32 (N, 1, 28, 28) in [0, 1], the model's input."""
    return (images.astype(np.float32) / 255.0)[:, None, :, :]


if __name__ == "__main__":
    sys.exit(0 if build_cache() else 1)
