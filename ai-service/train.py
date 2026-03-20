"""
train.py — Train the CNN on the EMNIST-balanced dataset.

Usage:
    cd ai-service
    python train.py

This will:
    1. Download EMNIST-balanced via torchvision
    2. Preprocess images (normalise, fix rotation/transpose)
    3. Train the CNN for a configurable number of epochs
    4. Save weights to saved_model/emnist_cnn.pth

EMNIST-balanced contains 47 classes:
    Digits 0-9, uppercase A-Z, and 11 lowercase letters (a,b,d,e,f,g,h,n,q,r,t)
    ~112,800 training samples
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms

from model import build_model, MODEL_PATH

EPOCHS = 10
BATCH_SIZE = 128
VALIDATION_SPLIT = 0.1
LEARNING_RATE = 1e-3
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def get_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


class TransposeTransform:
    """Transpose height and width dims to fix EMNIST orientation."""
    def __call__(self, x):
        return x.permute(0, 2, 1)


def load_emnist_balanced():
    """
    Load EMNIST-balanced dataset via torchvision.
    """
    # EMNIST images come transposed; TransposeTransform fixes orientation
    transform = transforms.Compose([
        transforms.ToTensor(),  # converts to [0,1] float, shape (1,28,28)
        TransposeTransform(),
    ])

    train_ds = datasets.EMNIST(
        root=DATA_DIR, split="balanced", train=True,
        download=True, transform=transform,
    )
    test_ds = datasets.EMNIST(
        root=DATA_DIR, split="balanced", train=False,
        download=True, transform=transform,
    )
    num_classes = 47
    print(f"[train] Loaded EMNIST-balanced: {len(train_ds)} train, {len(test_ds)} test")
    return train_ds, test_ds, num_classes


def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        correct += (outputs.argmax(1) == labels).sum().item()
        total += images.size(0)

    return running_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0
    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)
        outputs = model(images)
        loss = criterion(outputs, labels)

        running_loss += loss.item() * images.size(0)
        correct += (outputs.argmax(1) == labels).sum().item()
        total += images.size(0)

    return running_loss / total, correct / total


def main():
    device = get_device()
    print(f"[train] Using device: {device}")

    train_ds, test_ds, num_classes = load_emnist_balanced()

    val_size = int(len(train_ds) * VALIDATION_SPLIT)
    train_size = len(train_ds) - val_size
    train_subset, val_subset = random_split(train_ds, [train_size, val_size])

    train_loader = DataLoader(train_subset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_subset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    print(f"[train] Train: {train_size}, Val: {val_size}, Test: {len(test_ds)}, Classes: {num_classes}")

    model = build_model(num_classes).to(device)
    print(model)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=2)

    best_val_acc = 0.0
    patience_counter = 0
    patience_limit = 3

    for epoch in range(1, EPOCHS + 1):
        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_acc = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        lr = optimizer.param_groups[0]["lr"]
        print(f"  Epoch {epoch}/{EPOCHS}  "
              f"train_loss={train_loss:.4f}  train_acc={train_acc:.4f}  "
              f"val_loss={val_loss:.4f}  val_acc={val_acc:.4f}  lr={lr:.1e}")

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0
            
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            torch.save(model.state_dict(), MODEL_PATH)
        else:
            patience_counter += 1
            if patience_counter >= patience_limit:
                print(f"[train] Early stopping at epoch {epoch}")
                break

    model.load_state_dict(torch.load(MODEL_PATH, map_location=device, weights_only=True))
    test_loss, test_acc = evaluate(model, test_loader, criterion, device)
    print(f"\n[train] Test accuracy: {test_acc:.4f}  |  Test loss: {test_loss:.4f}")
    print(f"[train] Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
