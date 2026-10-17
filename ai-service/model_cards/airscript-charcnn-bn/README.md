---
license: mit
language:
  - bn
tags:
  - image-classification
  - handwriting-recognition
  - bengali
  - bangla
  - onnx
  - pytorch
datasets:
  - BanglaLekha-Isolated
metrics:
  - accuracy
library_name: pytorch
pipeline_tag: image-classification
---

# AirScript CharCNN (Bengali / বাংলা, BanglaLekha-Isolated)

The Bengali character recogniser behind [AirScript](https://github.com/saminul-amin/air-script),
a touchless air-writing app. It classifies one isolated handwritten Bengali
character (a 28×28 white-on-black image) into one of 84 classes: the 11
independent vowels, 39 consonants (including ড় ঢ় য় ৎ ং ঃ ঁ), the 10 digits,
and the 24 compound characters (যুক্তাক্ষর) of BanglaLekha-Isolated.

In the app this model runs **in the browser** with ONNX Runtime Web. The app
composes words from isolated characters with one rule: an independent vowel
written right after a consonant becomes that vowel's sign (ক + ই → কি).

## Files

| File | What | Size |
|---|---|---|
| `bn_cnn.pth` | PyTorch `state_dict` | 6.9 MB |
| `bn_cnn.onnx` | ONNX export, fp32, opset 17 | 6.88 MB |
| `bn_cnn.int8.onnx` | ONNX export, int8 dynamic quantisation | 1.73 MB |
| `*.sha256` | SHA-256 of each file, as pinned in the app | |

ONNX contract: input `image` float32 `(batch, 1, 28, 28)` in `[0, 1]`,
white ink on black; output `logits` float32 `(batch, 84)`. Apply softmax
yourself. Class order: `BENGALI_LABELS` in `ai-service/model_bn.py`
(vowels, consonants, digits, compounds, in the dataset's folder order).

**Compound-character labels (classes 61–84) are a reading of the handwriting
by eye and have not yet been verified by a native speaker.** The dataset
ships no character list for its folders. A wrong label is a string, not a
retraining: fix it in `model_bn.py` and `client/src/recognition/bengali.ts`.

## Architecture

```
Conv2d(1→32, 3×3, pad 1) → ReLU → Conv2d(32→64, 3×3, pad 1) → ReLU → MaxPool(2) → Dropout(0.25)
→ Conv2d(64→128, 3×3, pad 1) → ReLU → MaxPool(2) → Dropout(0.25)
→ Flatten → Linear(6272→256) → ReLU → Dropout(0.5) → Linear(256→84)
```

About 1.9 M parameters. Same layer plan as the English model, its own
module (`BengaliCNN`) and weights.

## Training data and recipe

BanglaLekha-Isolated: Biswas, M., Islam, R., Shom, G. K., Shopon, M.,
Mohammed, N., Momen, S., & Abedin, A. (2017). *BanglaLekha-Isolated: A
multi-purpose comprehensive dataset of Handwritten Bangla Isolated
characters.* Data in Brief, 12, 103–107. doi:10.1016/j.dib.2017.03.035.
Mendeley Data, doi:10.17632/hf6sf8zrkc.2, **CC BY 4.0**. 166,105 images from
1,990 handwriting forms (writers aged 4–27, two districts of Bangladesh),
scanned at 600 dpi, inverted to white on black, median-filtered and
edge-thickened by the dataset authors.

Every image was passed through the app's own 10-step preprocessing
(`ai-service/preprocessing.py`: blur, threshold, dilate, crop to the ink
with 20% padding, square, LANCZOS to 28×28), so the model sees in training
exactly what the browser produces at inference. Split **by writer form**:
15% of forms (24,851 images) held out as the test set, never trained on;
10% of the rest for validation.

Adam 1e-3, batch 256, cross-entropy, ReduceLROnPlateau, early stopping
(patience 3), best-validation checkpoint kept; 12 epochs on CPU
(`ai-service/train_bn.py`), 100 minutes. Validation accuracy was still
rising slowly at epoch 12 (0.8821), so more epochs would likely help.

## Evaluation

Held-out writers (24,851 images, 84 classes), measured with
`ai-service/evaluate_bn.py` on 17 October 2026:

| Model | Top-1 | Top-3 |
|---|---|---|
| PyTorch | 88.32 % | 96.00 % |
| ONNX fp32 | 88.32 % | 96.00 % |
| ONNX int8 | 88.27 % | 95.96 % |

Most confused pairs (true → predicted, share of the true class), with the
compound labels as currently read: `ক্ষ`→`স্ম` 18.5 %, `স্ক`→`ষ্ণ` 16.8 %,
`ম্প`→`ষ্প` 16.3 %, `স্ম`→`ক্ষ` 15.6 %, `ভ`→`ড` 12.9 %, `খ`→`থ` 11.2 %,
`ক্ত`→`ষ্ঠ` 7.1 %, `ষ্প`→`ম্প` 6.4 %, `ঊ`→`উ` 6.4 %, `ঙ্গ`→`প্ত` 6.4 %.
Weakest classes: `স্ম` 66.0 %, `ম্প` 67.7 %, `ক্ষ` 69.7 %, `ভ` 71.9 %, `স্ক` 74.4 %.

Basic characters and digits are strong; most of the error is among the
compound characters, which share sub-shapes and are the hardest to tell
apart at 28×28.

Accuracy on strokes drawn in the app has not been measured.

## Limitations and intended use

- Isolated characters only. No segmentation, no conjuncts beyond the 24 in
  the dataset, no vowel signs as separate classes (the app derives them from
  the composition rule), no hasanta, no য-ফলা / র-ফলা forms.
- 28×28 input: fine marks (the dot of ড় ঢ় য়, inner loops of compounds) are
  near the resolution limit.
- Trained on scanned pen-on-paper from Bangladeshi writers; mouse and
  air-written strokes are out of distribution and the app draws Bengali with
  thicker ink to come closer to the training data.
- Intended for interactive demos and education. Not for document OCR or any
  decision about a person.

## How to use

```python
import numpy as np, onnxruntime as ort
session = ort.InferenceSession("bn_cnn.int8.onnx")
x = np.zeros((1, 1, 28, 28), np.float32)  # preprocessed character, white on black, [0, 1]
logits = session.run(["logits"], {"image": x})[0]
# labels: BENGALI_LABELS from ai-service/model_bn.py (84 entries)
```

## Licence and citation

Weights and code: MIT (Md. Saminul Amin, 2026). Trained on
BanglaLekha-Isolated (CC BY 4.0); please cite Biswas et al. (2017) as above.
