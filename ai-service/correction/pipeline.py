"""
pipeline.py — Orchestrates the full text correction pipeline.

Stages (in order):
    1. Dot merging          – merge isolated dots into i/j
    2. Character disambiguation – fix 0↔O, 1↔I, 8↔B etc.
    3. Assemble raw text    – join characters into a string
    4. Personal dictionary  – apply user-learned corrections
    5. Spell correction     – fix misspelled words
    6. Formatting           – capitalization + punctuation + spacing

The pipeline accepts the same character-dict list used by the frontend
and returns both the raw (uncorrected) text and the corrected text.
"""

from __future__ import annotations

import logging

from correction.context_rules import disambiguate_characters, merge_dots
from correction.spell_corrector import correct_text
from correction.punctuation import insert_pause_punctuation, format_text
from nlp.personalizer import apply_personal_corrections

logger = logging.getLogger(__name__)


def process_characters(
    characters: list[dict],
    confidence_threshold: float = 0.85,
) -> dict:
    """
    Full correction pipeline.

    Parameters
    ----------
    characters : list[dict]
        Each dict must have at minimum:
            label      – str, the predicted character
            confidence – float 0-1
        Optional:
            top3           – list[str]
            pause_before_ms – int, idle time before this character

    confidence_threshold : float
        Characters at or above this confidence are trusted and not
        disambiguated. Lower values = more aggressive correction.

    Returns
    -------
    dict with:
        raw_text       – characters joined as-is (before any correction)
        corrected_text – fully corrected and formatted text
        characters     – the character list after disambiguation (with
                         a "corrected" flag on changed entries)
        stages         – dict of intermediate results for debugging
    """
    chars = _normalise(characters)

    raw_text = "".join(ch["label"] for ch in chars)

    chars = merge_dots(chars)
    after_dot_merge = "".join(ch["label"] for ch in chars)

    chars = insert_pause_punctuation(chars)
    after_punctuation = "".join(ch["label"] for ch in chars)

    chars = disambiguate_characters(chars, confidence_threshold)
    after_disambig = "".join(ch["label"] for ch in chars)

    assembled = "".join(ch["label"] for ch in chars)
    after_personal = apply_personal_corrections(assembled)

    after_spell = correct_text(after_personal)

    corrected = format_text(after_spell)

    logger.info("Pipeline: '%s' → '%s'", raw_text, corrected)

    return {
        "raw_text": raw_text,
        "corrected_text": corrected,
        "characters": chars,
        "stages": {
            "after_dot_merge": after_dot_merge,
            "after_punctuation": after_punctuation,
            "after_disambiguation": after_disambig,
            "after_personal_dict": after_personal,
            "after_spell_correction": after_spell,
            "after_formatting": corrected,
        },
    }


def _normalise(characters: list[dict]) -> list[dict]:
    """Ensure every character dict has the required keys."""
    normalised = []
    for ch in characters:
        normalised.append({
            "label": str(ch.get("label", "")),
            "confidence": float(ch.get("confidence", 0.0)),
            "top3": list(ch.get("top3", [])),
            "pause_before_ms": int(ch.get("pause_before_ms", 0)),
        })
    return normalised
