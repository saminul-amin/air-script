---
title: AirScript Backend
emoji: ✍️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: CharCNN + NLP correction API for AirScript air-writing
---

# AirScript AI service

FastAPI inference service for [AirScript](https://github.com/saminul-amin/air-script):
a CharCNN trained on EMNIST Balanced (47 classes) plus a spell-correction and
word-prediction pipeline.

- `GET /health` reports whether the trained weights are loaded, with their SHA-256.
- `POST /predict-character` takes a PNG of one character and returns the top-3 labels.
- `POST /process-text`, `/suggest`, `/autocomplete`, `/learn` power the text pipeline.

The service refuses to start if `saved_model/emnist_cnn.pth` is missing or does
not match `saved_model/emnist_cnn.sha256`. Full setup, deployment and test
instructions live in the main repository README.
