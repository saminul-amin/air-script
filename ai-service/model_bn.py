"""
model_bn.py — The Bengali (বাংলা) character recogniser.

A separate module from model.py on purpose: the English CharCNN, its weights
and its checksum are untouched. The architecture is the same family (three
convolutions, two linear layers, 28×28 single-channel input), with the class
count set by the Bengali label set below.

Dataset: BanglaLekha-Isolated (Biswas et al., 2017, CC BY 4.0), 84 classes:
    1–11   the 11 independent vowels (স্বরবর্ণ)
    12–50  the 39 consonants (ব্যঞ্জনবর্ণ), including ড় ঢ় য় ৎ ং ঃ ঁ
    51–60  the 10 digits ০–৯
    61–84  24 frequently used compound characters (যুক্তাক্ষর)
The class order is the dataset's folder order; ``BENGALI_LABELS[i]`` is the
Unicode string for folder ``i + 1``. The mapping was checked by eye against
sample images of every folder (see tools/bn_contact_sheet.py).
"""

from __future__ import annotations

import os

import torch
import torch.nn as nn

_HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH_BN = os.path.join(_HERE, "saved_model", "bn_cnn.pth")

VOWELS = ["অ", "আ", "ই", "ঈ", "উ", "ঊ", "ঋ", "এ", "ঐ", "ও", "ঔ"]
CONSONANTS = [
    "ক", "খ", "গ", "ঘ", "ঙ",
    "চ", "ছ", "জ", "ঝ", "ঞ",
    "ট", "ঠ", "ড", "ঢ", "ণ",
    "ত", "থ", "দ", "ধ", "ন",
    "প", "ফ", "ব", "ভ", "ম",
    "য", "র", "ল", "শ", "ষ", "স", "হ",
    "ড়", "ঢ়", "য়", "ৎ", "ং", "ঃ", "ঁ",
]
DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"]
# Folders 61–84. The dataset ships no character list for these, so the mapping
# was read by eye from the handwriting against printed glyphs and checked with a
# nearest-centroid comparison (tools/bn_check_compounds.py). Treat as "best
# reading", verified by a native speaker before any model card is published.
COMPOUNDS = [
    "ক্ষ", "ব্দ", "ঙ্ক", "ষ্ণ", "স্ক", "স্থ",
    "চ্ছ", "ত্ত", "ন্ন", "ষ্ট", "ম্প", "স্ম",
    "প্ত", "ম্ব", "ঙ্গ", "দ্ধ", "শ্চ", "ষ্ঠ",
    "ল্প", "ষ্প", "ন্দ", "ন্ধ", "ম্ম", "ক্ত",
]

BENGALI_LABELS: list[str] = VOWELS + CONSONANTS + DIGITS + COMPOUNDS
NUM_CLASSES_BN = len(BENGALI_LABELS)


class BengaliCNN(nn.Module):
    """Same layer plan as CharCNN; its own class so the two models never share code paths or weights."""

    def __init__(self, num_classes: int = NUM_CLASSES_BN):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout(0.25),

            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Dropout(0.25),
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(128 * 7 * 7, 256), nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(self.features(x))


def build_model_bn(num_classes: int = NUM_CLASSES_BN) -> BengaliCNN:
    return BengaliCNN(num_classes)
