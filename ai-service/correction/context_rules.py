"""
context_rules.py — Character disambiguation and dot-merging.

Resolves ambiguous CNN predictions using surrounding-character context:
  - 0 ↔ O  (zero vs letter O)
  - 1 ↔ I / L  (one vs I vs lowercase L)
  - 8 ↔ B  (eight vs letter B)
  - 5 ↔ S
  - 2 ↔ Z

Also handles the "small i / j" dot-merging problem where a dot drawn
separately above a previous character should be merged into 'i' or 'j'.
"""

from __future__ import annotations

ALPHA_REPLACEMENTS: dict[str, str] = {
    "0": "O",
    "1": "I",
    "8": "B",
    "5": "S",
    "2": "Z",
}

DIGIT_REPLACEMENTS: dict[str, str] = {
    "O": "0",
    "o": "0",
    "I": "1",
    "l": "1",
    "L": "1",
    "B": "8",
    "S": "5",
    "Z": "2",
    "s": "5",
    "z": "2",
}

DOT_CHARS = {".", ",", "'", "`", "*"}

DOT_MERGE_MAP: dict[str, str] = {
    "i": "i",   # undotted i + dot  → dotted i (no-op in ASCII)
    "I": "i",   # capital I treated as undotted i when followed by dot
    "1": "i",   # misread 1 + dot   → i
    "l": "i",   # misread l + dot   → i
    "j": "j",
    "J": "j",
}


def _is_alpha_context(left: str | None, right: str | None) -> bool:
    """Return True if surrounding characters are alphabetic."""
    l_alpha = left is not None and left.isalpha()
    r_alpha = right is not None and right.isalpha()
    return l_alpha or r_alpha


def _is_digit_context(left: str | None, right: str | None) -> bool:
    """Return True if surrounding characters are digits."""
    l_digit = left is not None and left.isdigit()
    r_digit = right is not None and right.isdigit()
    return l_digit or r_digit


def disambiguate_characters(
    characters: list[dict],
    confidence_threshold: float = 0.85,
) -> list[dict]:
    """
    Apply context-based disambiguation to a list of character dicts.

    Each dict has:
        label       – predicted character string
        confidence  – float 0-1
        top3        – list[str] of top-3 predictions

    Characters with confidence >= threshold are left unchanged (the CNN
    is confident enough). Below that threshold, contextual rules kick in.

    Returns a new list (does not mutate the input).
    """
    result: list[dict] = [ch.copy() for ch in characters]

    for i, ch in enumerate(result):
        if ch["label"] == " ":
            continue

        if ch["confidence"] >= confidence_threshold:
            continue

        label = ch["label"]
        left = result[i - 1]["label"] if i > 0 and result[i - 1]["label"] != " " else None
        right = (
            result[i + 1]["label"]
            if i + 1 < len(result) and result[i + 1]["label"] != " "
            else None
        )

        if label in ALPHA_REPLACEMENTS and _is_alpha_context(left, right):
            ch["label"] = ALPHA_REPLACEMENTS[label]
            ch["corrected"] = True
            continue

        if label in DIGIT_REPLACEMENTS and _is_digit_context(left, right):
            ch["label"] = DIGIT_REPLACEMENTS[label]
            ch["corrected"] = True
            continue

        if label == "1" and left is None and right is not None and right.isalpha():
            ch["label"] = "I"
            ch["corrected"] = True
            continue

    return result


def merge_dots(characters: list[dict]) -> list[dict]:
    """
    Detect isolated dots drawn above a previous character and merge them.

    If a character looks like a dot (., comma, or similar tiny stroke)
    and the preceding character is one that gains a dot (i, j, l, 1),
    merge them into the dotted letter and remove the dot entry.
    """
    if len(characters) < 2:
        return characters

    merged: list[dict] = []
    skip_next = False

    for i, ch in enumerate(characters):
        if skip_next:
            skip_next = False
            continue

        if i + 1 < len(characters):
            next_ch = characters[i + 1]
            if (
                next_ch["label"] in DOT_CHARS
                and next_ch["confidence"] < 0.7
                and ch["label"] in DOT_MERGE_MAP
            ):
                new_ch = ch.copy()
                new_ch["label"] = DOT_MERGE_MAP[ch["label"]]
                new_ch["corrected"] = True
                merged.append(new_ch)
                skip_next = True
                continue

        merged.append(ch)

    return merged
