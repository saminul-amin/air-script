---
license: mit
language:
  - en
tags:
  - image-classification
  - handwriting-recognition
  - onnx
  - pytorch
  - emnist
datasets:
  - emnist
metrics:
  - accuracy
library_name: pytorch
pipeline_tag: image-classification
---

# AirScript CharCNN (English, EMNIST Balanced)

The character recogniser behind [AirScript](https://github.com/saminul-amin/air-script),
a touchless air-writing app. It classifies a single handwritten character
(a 28×28 white-on-black image) into one of the 47 EMNIST Balanced classes:
digits `0–9`, uppercase `A–Z`, and the lowercase letters `a b d e f g h n q r t`
(EMNIST merges the other lowercase letters into their uppercase class).

In the app this model runs **in the browser** with ONNX Runtime Web; the
Python service keeps the same weights for a server-side fallback.

## Files

| File | What | Size |
|---|---|---|
| `emnist_cnn.pth` | PyTorch `state_dict` | 6.8 MB |
| `emnist_cnn.onnx` | ONNX export, fp32, opset 17 | 6.85 MB |
| `emnist_cnn.int8.onnx` | ONNX export, int8 dynamic quantisation | 1.72 MB |
| `*.sha256` | SHA-256 of each file, as pinned in the app | |

ONNX contract: input `image` float32 `(batch, 1, 28, 28)` in `[0, 1]`,
white ink on black; output `logits` float32 `(batch, 47)`. Apply softmax
yourself.

## Architecture

```
Conv2d(1→32, 3×3, pad 1) → ReLU → Conv2d(32→64, 3×3, pad 1) → ReLU → MaxPool(2) → Dropout(0.25)
→ Conv2d(64→128, 3×3, pad 1) → ReLU → MaxPool(2) → Dropout(0.25)
→ Flatten → Linear(6272→256) → ReLU → Dropout(0.5) → Linear(256→47)
```

About 1.9 M parameters. Defined in `ai-service/model.py` (`CharCNN`).

## Training data and recipe

EMNIST Balanced (Cohen, Afshar, Tapson, van Schaik, 2017: *EMNIST: an
extension of MNIST to handwritten letters*, derived from NIST Special
Database 19). 112,800 training images (10% held out for validation),
18,800 test images, 47 balanced classes. Images are used at their native
28×28 after the transpose that gives EMNIST its upright orientation.

Adam, learning rate 1e-3, batch 128, cross-entropy, ReduceLROnPlateau on
validation loss, early stopping after three epochs without improvement,
best-validation checkpoint kept. `ai-service/train.py`.

## Preprocessing

The model expects the output of the app's 10-step pipeline
(`ai-service/preprocessing.py`, ported bit-exactly to TypeScript for the
browser): composite on black → grayscale → Gaussian blur (radius 1.5) →
threshold at 30 → 3×3 dilation → crop to the ink's bounding box with 20%
padding → pad to a square → LANCZOS resize to 28×28 → scale to `[0, 1]`
(inverted if the mean is above 0.5).

## Evaluation

EMNIST Balanced test split, 18,800 samples, measured with
`ai-service/evaluate.py` on 17 October 2026:

| Model | Top-1 | Top-3 |
|---|---|---|
| PyTorch | 87.06 % | 98.59 % |
| ONNX fp32 | 87.06 % | 98.59 % |
| ONNX int8 | 87.04 % | 98.59 % |

PyTorch and the fp32 export agree on the top-1 class for every test sample
(max logit difference 9.5 × 10⁻⁶).

Most confused pairs (true → predicted, share of the true class):
`O`→`0` 42.2 %, `F`→`f` 36.2 %, `q`→`9` 32.8 %, `L`→`1` 32.5 %, `f`→`F` 29.8 %,
`1`→`L` 21.0 %, `I`→`1` 20.5 %, `g`→`9` 17.2 %, `5`→`S` 17.0 %, `0`→`O` 16.2 %.
Weakest classes: `q` 51.0 %, `L` 51.5 %, `g` 55.0 %, `O` 56.8 %, `F` 60.5 %.

These are the pairs EMNIST itself cannot separate (`L` contains handwritten
`l`, so `L`/`1`/`I` and `O`/`0` are the same shapes); in AirScript the
context-aware correction pipeline resolves them.

Accuracy on strokes drawn in the app (mouse or air-writing, not scanned pen
on paper) has not been measured yet; expect it to be lower than the
benchmark figure.

## Limitations and intended use

- Isolated characters only. No segmentation, no words, no cursive.
- 47 classes: no punctuation, no lowercase `c i j k l m o p s u v w x y z`
  (they are predicted as their uppercase form).
- Trained on scanned pen-on-paper from NIST SD19 writers; thick, smooth
  strokes from a mouse or a tracked fingertip are out of distribution.
- Intended for interactive demos and education. Not for document OCR,
  signature verification, or any decision about a person.

## How to use

```python
import numpy as np, onnxruntime as ort
session = ort.InferenceSession("emnist_cnn.int8.onnx")
x = np.zeros((1, 1, 28, 28), np.float32)  # preprocessed character, white on black, [0, 1]
logits = session.run(["logits"], {"image": x})[0]
labels = list("0123456789") + list("ABCDEFGHIJKLMNOPQRSTUVWXYZ") + list("abdefghnqrt")
print(labels[int(logits.argmax())])
```

## Licence and citation

Weights and code: MIT (Md. Saminul Amin, 2026). EMNIST: Cohen, G., Afshar,
S., Tapson, J., & van Schaik, A. (2017). *EMNIST: an extension of MNIST to
handwritten letters.* arXiv:1702.05373.
