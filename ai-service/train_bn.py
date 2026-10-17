"""
train_bn.py — Train the Bengali recogniser on BanglaLekha-Isolated.

Usage:
    cd ai-service
    python preprocessing_bn.py            # once: cache the 28×28 inputs (needs the dataset on disk)
    python train_bn.py --estimate         # time a few batches and extrapolate per epoch
    python train_bn.py                    # train, write saved_model/bn_cnn.pth + bn_cnn.sha256

Recipe (the same as train.py for the English model): Adam 1e-3, batch 128,
cross-entropy, ReduceLROnPlateau on validation loss, early stopping after 3
epochs without improvement, best-validation checkpoint kept. The split is by
writer form (preprocessing_bn.split_by_writer): 15% of forms are held out as
the test set and never seen in training; 10% of the remaining images are the
validation set.

The whole thing runs on CPU; see --estimate for how long on this machine.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import time

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset, random_split

from model_bn import MODEL_PATH_BN, NUM_CLASSES_BN, build_model_bn
from preprocessing_bn import load_cache, split_by_writer, to_float

EPOCHS = 12
BATCH_SIZE = 256
VALIDATION_SPLIT = 0.1
LEARNING_RATE = 1e-3
PATIENCE = 3
SEED = 20261017


def sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def datasets():
    images, labels, forms = load_cache()
    train_mask, test_mask = split_by_writer(forms)
    x = torch.from_numpy(to_float(images))
    y = torch.from_numpy(labels)
    train_full = TensorDataset(x[train_mask], y[train_mask])
    test_ds = TensorDataset(x[test_mask], y[test_mask])
    n_val = int(len(train_full) * VALIDATION_SPLIT)
    train_ds, val_ds = random_split(train_full, [len(train_full) - n_val, n_val], generator=torch.Generator().manual_seed(SEED))
    print(
        f"[train_bn] {len(images)} images, {len(np.unique(forms))} writer forms; "
        f"train {len(train_ds)}, val {len(val_ds)}, test {len(test_ds)} (unseen writers), classes {NUM_CLASSES_BN}"
    )
    return train_ds, val_ds, test_ds


def run_epoch(model, loader, criterion, optimizer=None, device="cpu"):
    training = optimizer is not None
    model.train(training)
    loss_sum, correct, total = 0.0, 0, 0
    with torch.set_grad_enabled(training):
        for xb, yb in loader:
            xb, yb = xb.to(device), yb.to(device)
            out = model(xb)
            loss = criterion(out, yb)
            if training:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
            loss_sum += loss.item() * xb.size(0)
            correct += (out.argmax(1) == yb).sum().item()
            total += xb.size(0)
    return loss_sum / total, correct / total


def estimate(train_ds, batches: int = 30) -> None:
    model = build_model_bn()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True)
    it = iter(loader)
    # Warm up, then time.
    for _ in range(3):
        xb, yb = next(it)
        optimizer.zero_grad()
        criterion(model(xb), yb).backward()
        optimizer.step()
    t0 = time.perf_counter()
    for _ in range(batches):
        xb, yb = next(it)
        optimizer.zero_grad()
        criterion(model(xb), yb).backward()
        optimizer.step()
    per_batch = (time.perf_counter() - t0) / batches
    n_batches = len(loader)
    print(
        f"[train_bn] {per_batch * 1000:.0f} ms per batch of {BATCH_SIZE} → "
        f"{per_batch * n_batches / 60:.1f} min per epoch ({n_batches} batches), "
        f"about {per_batch * n_batches * EPOCHS / 60:.0f} min for {EPOCHS} epochs at most; torch threads {torch.get_num_threads()}"
    )


def train(train_ds, val_ds, test_ds) -> None:
    torch.manual_seed(SEED)
    device = torch.device("cpu")
    model = build_model_bn().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=2)
    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=512, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=512, shuffle=False, num_workers=0)

    best_val, since_best = 0.0, 0
    os.makedirs(os.path.dirname(MODEL_PATH_BN), exist_ok=True)
    started = time.perf_counter()
    for epoch in range(1, EPOCHS + 1):
        t0 = time.perf_counter()
        tr_loss, tr_acc = run_epoch(model, train_loader, criterion, optimizer, device)
        va_loss, va_acc = run_epoch(model, val_loader, criterion, None, device)
        scheduler.step(va_loss)
        lr = optimizer.param_groups[0]["lr"]
        print(
            f"  epoch {epoch}/{EPOCHS}  train_loss={tr_loss:.4f} train_acc={tr_acc:.4f}  "
            f"val_loss={va_loss:.4f} val_acc={va_acc:.4f}  lr={lr:.1e}  ({(time.perf_counter() - t0) / 60:.1f} min)",
            flush=True,
        )
        if va_acc > best_val:
            best_val, since_best = va_acc, 0
            torch.save(model.state_dict(), MODEL_PATH_BN)
        else:
            since_best += 1
            if since_best >= PATIENCE:
                print(f"[train_bn] early stopping at epoch {epoch}")
                break

    model.load_state_dict(torch.load(MODEL_PATH_BN, map_location="cpu", weights_only=True))
    te_loss, te_acc = run_epoch(model, test_loader, criterion, None, device)
    digest = sha256_of(MODEL_PATH_BN)
    with open(os.path.splitext(MODEL_PATH_BN)[0] + ".sha256", "w", encoding="utf-8", newline="\n") as fh:
        fh.write(f"{digest}  {os.path.basename(MODEL_PATH_BN)}\n")
    print(
        f"\n[train_bn] best val_acc={best_val:.4f}; test (unseen writers) top-1={te_acc:.4f} loss={te_loss:.4f}; "
        f"{(time.perf_counter() - started) / 60:.1f} min total"
    )
    print(f"[train_bn] saved {MODEL_PATH_BN} (sha256 {digest[:12]}...)")
    print("[train_bn] now run `python export_onnx_bn.py --quantize` and `python evaluate_bn.py`")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--estimate", action="store_true", help="time a few batches and print the per-epoch estimate")
    args = parser.parse_args(argv)
    train_ds, val_ds, test_ds = datasets()
    if args.estimate:
        estimate(train_ds)
        return 0
    train(train_ds, val_ds, test_ds)
    return 0


if __name__ == "__main__":
    sys.exit(main())
