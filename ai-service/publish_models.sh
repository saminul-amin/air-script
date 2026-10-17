#!/usr/bin/env bash
# Publish the two character recognisers to Hugging Face as model repos.
#
#   cd ai-service
#   hf auth login                 # you, never a token in a file or a chat
#   bash publish_models.sh        # dry run: prints what would be created and uploaded
#   bash publish_models.sh --go   # creates the repos (if missing) and uploads
#
# Each repo gets the .pth, both ONNX exports, their .sha256 files, and the
# model card from model_cards/<repo>/README.md. Nothing else.
set -euo pipefail
cd "$(dirname "$0")"

USER="${HF_USER:-saminul-amin}"
GO=0
[[ "${1:-}" == "--go" ]] && GO=1

publish() {
  local repo="$1" card="$2"; shift 2
  local files=("$@")
  echo "== $USER/$repo"
  for f in "${files[@]}"; do
    [[ -f "$f" ]] || { echo "   missing: $f" >&2; exit 1; }
    echo "   $f ($(du -h "$f" | cut -f1))"
  done
  echo "   card: $card"
  if (( GO )); then
    hf repo create "$USER/$repo" --repo-type model --exist-ok
    hf upload "$USER/$repo" "$card" README.md --repo-type model
    for f in "${files[@]}"; do
      hf upload "$USER/$repo" "$f" "$(basename "$f")" --repo-type model
    done
    echo "   https://huggingface.co/$USER/$repo"
  fi
}

publish airscript-charcnn-en model_cards/airscript-charcnn-en/README.md \
  saved_model/emnist_cnn.pth saved_model/emnist_cnn.sha256 \
  saved_model/emnist_cnn.onnx saved_model/emnist_cnn.onnx.sha256 \
  saved_model/emnist_cnn.int8.onnx saved_model/emnist_cnn.int8.onnx.sha256

publish airscript-charcnn-bn model_cards/airscript-charcnn-bn/README.md \
  saved_model/bn_cnn.pth saved_model/bn_cnn.sha256 \
  saved_model/bn_cnn.onnx saved_model/bn_cnn.onnx.sha256 \
  saved_model/bn_cnn.int8.onnx saved_model/bn_cnn.int8.onnx.sha256

(( GO )) || echo "dry run only; add --go to create and upload (after hf auth login)"
