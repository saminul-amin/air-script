"""
spell_corrector.py — Dictionary-based spell correction using SymSpellPy.

Uses a pre-built frequency dictionary for fast Levenshtein-distance lookups.
Falls back to a small built-in word set if symspellpy is unavailable.

Key features:
    - Corrects words not found in dictionary to closest match
    - Short-word specialist: dedicated correction for 1-2 letter words
    - Confidence-weighted: low-confidence words get stronger correction
    - Preserves numbers and single valid characters
"""

from __future__ import annotations

import re
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Try to load symspellpy; fall back to a simple approach otherwise
# ---------------------------------------------------------------------------
_sym_spell = None

try:
    from symspellpy import SymSpell, Verbosity

    _sym_spell = SymSpell(max_dictionary_edit_distance=2, prefix_length=7)

    # Use the built-in frequency dictionary shipped with symspellpy
    import importlib.resources as _res
    import symspellpy as _pkg

    _dict_path = str(_res.files(_pkg) / "frequency_dictionary_en_82_765.txt")
    _sym_spell.load_dictionary(_dict_path, term_index=0, count_index=1)
    logger.info("SymSpellPy loaded with %d words", _sym_spell.word_count)

except Exception as exc:
    logger.warning("SymSpellPy unavailable (%s); using fallback corrector", exc)

# ---------------------------------------------------------------------------
# Common short words — used for dedicated short-word correction
# ---------------------------------------------------------------------------
_SHORT_WORDS_1: set[str] = {
    "a", "i",
}

_SHORT_WORDS_2: set[str] = {
    "is", "am", "an", "as", "at", "be", "by", "do", "go", "he",
    "if", "in", "it", "me", "my", "no", "of", "ok", "on", "or",
    "so", "to", "up", "us", "we",
}

# Common OCR confusions for short words:  misread → correct
_SHORT_WORD_FIXES: dict[str, str] = {
    # 1-letter
    "l": "i",  # lowercase L → i (very common misread)
    # 2-letter
    "ls": "is", "1s": "is", "lS": "is",
    "ln": "in", "1n": "in",
    "lt": "it", "1t": "it",
    "0n": "on", "0f": "of", "0r": "or",
    "t0": "to", "tO": "to",
    "n0": "no", "nO": "no",
    "s0": "so", "sO": "so",
    "g0": "go", "gO": "go",
    "d0": "do", "dO": "do",
    "arn": "am", "arN": "am",
    "aM": "am", "aN": "an", "aS": "as", "aT": "at",
    "bY": "by", "hE": "he", "iF": "if", "iN": "in",
    "iT": "it", "mE": "me", "mY": "my", "nO": "no",
    "oF": "of", "oK": "ok", "oN": "on", "oR": "or",
    "sO": "so", "tO": "to", "uP": "up", "uS": "us",
    "wE": "we",
    "lf": "if",
    "lm": "im",
    "be": "be", "Be": "be",
}

# ---------------------------------------------------------------------------
# Small fallback set of very common English words (used if symspellpy fails)
# ---------------------------------------------------------------------------
_COMMON_WORDS: set[str] = {
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her",
    "she", "or", "an", "will", "my", "one", "all", "would", "there",
    "their", "what", "so", "up", "out", "if", "about", "who", "get",
    "which", "go", "me", "when", "make", "can", "like", "time", "no",
    "just", "him", "know", "take", "people", "into", "year", "your",
    "good", "some", "could", "them", "see", "other", "than", "then",
    "now", "look", "only", "come", "its", "over", "think", "also",
    "back", "after", "use", "two", "how", "our", "work", "first",
    "well", "way", "even", "new", "want", "because", "any", "these",
    "give", "day", "most", "us", "is", "am", "are", "was", "were",
    "been", "has", "had", "did", "done", "hello", "world", "test",
    "fine", "great", "yes", "no", "ok", "please", "thank", "thanks",
    "sorry", "help", "need", "name", "here", "where", "when", "why",
    "how", "much", "many", "very", "too", "more", "less", "really",
}


def _levenshtein(s1: str, s2: str) -> int:
    """Simple Levenshtein distance (for fallback mode)."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            cost = 0 if c1 == c2 else 1
            curr.append(min(curr[j] + 1, prev[j + 1] + 1, prev[j] + cost))
        prev = curr
    return prev[-1]


def _fallback_correct(word: str) -> str:
    """Correct using the small built-in word set."""
    lower = word.lower()
    if lower in _COMMON_WORDS:
        return word  # already correct
    if len(lower) <= 1:
        return word

    best, best_dist = word, 3  # max distance we consider
    for candidate in _COMMON_WORDS:
        if abs(len(candidate) - len(lower)) > 2:
            continue
        d = _levenshtein(lower, candidate)
        if d < best_dist:
            best_dist = d
            best = candidate
    return best if best_dist <= 2 else word


def _correct_short_word(word: str) -> str:
    """
    Dedicated correction for 1-2 letter words using dictionary + OCR fixes.
    Short words are too small for general Levenshtein to work reliably.
    """
    lower = word.lower()

    # Already a valid short word? Keep it.
    if len(lower) == 1 and lower in _SHORT_WORDS_1:
        return word
    if len(lower) == 2 and lower in _SHORT_WORDS_2:
        return word

    # Check the explicit OCR fix table first
    if word in _SHORT_WORD_FIXES:
        return _SHORT_WORD_FIXES[word]
    if lower in _SHORT_WORD_FIXES:
        return _apply_case_pattern(_SHORT_WORD_FIXES[lower], word)

    # For 2-letter words: find closest valid short word by Levenshtein
    if len(lower) == 2:
        best, best_dist = word, 2
        for candidate in _SHORT_WORDS_2:
            d = _levenshtein(lower, candidate)
            if d < best_dist:
                best_dist = d
                best = candidate
        if best_dist <= 1:
            return _apply_case_pattern(best, word)

    # Single characters that aren't valid words and aren't fixable — pass through
    return word


def correct_word(word: str) -> str:
    """
    Correct a single word using the best available method.
    Returns the corrected word (preserves case pattern if possible).
    """
    # Don't correct pure digits or empty strings
    if word.isdigit() or not word.strip():
        return word

    # --- Short-word specialist (1-2 chars) ---
    if len(word) <= 2:
        return _correct_short_word(word)

    if _sym_spell is not None:
        suggestions = _sym_spell.lookup(
            word.lower(),
            Verbosity.CLOSEST,
            max_edit_distance=2,
        )
        if suggestions:
            corrected = suggestions[0].term
            # Restore original case pattern
            return _apply_case_pattern(corrected, word)
        return word
    else:
        corrected = _fallback_correct(word)
        return _apply_case_pattern(corrected, word)


def _apply_case_pattern(corrected: str, original: str) -> str:
    """Apply the case pattern from original to the corrected word."""
    if original.isupper():
        return corrected.upper()
    if original.istitle():
        return corrected.capitalize()
    return corrected.lower()


def correct_text(text: str) -> str:
    """
    Correct all words in a text string.
    Preserves spacing and non-alphabetic tokens.
    """
    tokens = re.split(r"(\s+)", text)
    result = []
    for token in tokens:
        if token.strip() and any(c.isalpha() for c in token):
            result.append(correct_word(token))
        else:
            result.append(token)
    return "".join(result)


def is_valid_word(word: str) -> bool:
    """Check if a word exists in the dictionary."""
    if not word or len(word) <= 1:
        return True  # single letters are always 'valid'

    lower = word.lower()
    if _sym_spell is not None:
        suggestions = _sym_spell.lookup(lower, Verbosity.TOP, max_edit_distance=0)
        return len(suggestions) > 0
    else:
        return lower in _COMMON_WORDS
