"""
punctuation.py — Capitalization, punctuation, and sentence formatting.

Handles:
    - Sentence-initial capitalization
    - Lowercase normalization inside words
    - Standalone "i" → "I"
    - Pause-based punctuation (period/comma from pause metadata)
    - Basic sentence-ending cleanup
"""

from __future__ import annotations

import re


def apply_capitalization(text: str) -> str:
    """
    Smart capitalization:
      1. First letter of each sentence → uppercase
      2. Interior word characters → lowercase (unless single "I")
      3. Standalone "i" → "I"
    """
    if not text:
        return text

    # Split into sentences (by . ? !)
    sentences = re.split(r"(?<=[.?!])\s+", text)
    result = []

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue

        words = sentence.split()
        capitalized_words = []

        for idx, word in enumerate(words):
            # Standalone "i" always becomes "I"
            if word.lower() == "i" and len(word) == 1:
                capitalized_words.append("I")
                continue

            # Skip words that are pure digits or punctuation
            if not any(c.isalpha() for c in word):
                capitalized_words.append(word)
                continue

            if idx == 0:
                # First word of sentence → capitalize
                capitalized_words.append(word[0].upper() + word[1:].lower() if len(word) > 1 else word.upper())
            else:
                # Interior words → lowercase
                capitalized_words.append(word.lower())

        result.append(" ".join(capitalized_words))

    return ". ".join(result) if len(result) > 1 else (result[0] if result else "")


def insert_pause_punctuation(
    characters: list[dict],
    double_pause_ms: int = 1600,
    long_pause_ms: int = 2400,
) -> list[dict]:
    """
    Insert punctuation based on pause metadata in character entries.

    Each character dict may contain a 'pause_before_ms' field indicating
    the idle time before this character was drawn. Use this to infer:
      - Double pause (>= double_pause_ms) → insert period + space before
      - A long_pause_ms threshold is reserved for future sentence breaks

    Returns a new list with punctuation characters inserted.
    """
    if not characters:
        return characters

    result: list[dict] = []

    for ch in characters:
        pause = ch.get("pause_before_ms", 0)

        if pause >= double_pause_ms and result:
            # Check if the last non-space character already has punctuation
            last_label = ""
            for prev in reversed(result):
                if prev["label"].strip():
                    last_label = prev["label"]
                    break

            if last_label and last_label not in ".?!,":
                # Insert a period
                result.append({
                    "label": ".",
                    "confidence": 1.0,
                    "top3": ["."],
                    "auto_inserted": True,
                })
                # Insert space after period
                result.append({
                    "label": " ",
                    "confidence": 1.0,
                    "top3": [" "],
                    "auto_inserted": True,
                })

        result.append(ch)

    return result


def clean_spacing(text: str) -> str:
    """
    Normalize whitespace:
      - Collapse multiple spaces
      - Remove space before punctuation
      - Ensure space after punctuation
    """
    # Collapse runs of spaces
    text = re.sub(r" {2,}", " ", text)
    # Remove space before punctuation
    text = re.sub(r"\s+([.?!,])", r"\1", text)
    # Ensure space after punctuation (unless end of string)
    text = re.sub(r"([.?!,])([^\s])", r"\1 \2", text)
    return text.strip()


def format_text(text: str) -> str:
    """
    Full formatting pipeline:
      1. Clean spacing
      2. Apply capitalization
      3. Final cleanup
    """
    text = clean_spacing(text)
    text = apply_capitalization(text)
    text = clean_spacing(text)
    return text
