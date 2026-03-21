"""
personalizer.py — Personal writing style learning engine.

Learns from user corrections: when the user manually edits a word,
the original→corrected mapping is stored. On future encounters of
the same misrecognition, the learned correction is applied first.

Storage: JSON file on disk (persists across restarts).
Thread-safe for concurrent FastAPI requests.
"""

from __future__ import annotations

import json
import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

_DICT_PATH = Path(__file__).parent.parent / "data" / "personal_dictionary.json"
_lock = threading.Lock()

# In-memory dictionary: { lowercase_wrong: corrected_word }
_personal_dict: dict[str, str] = {}


def _load() -> None:
    """Load the personal dictionary from disk."""
    global _personal_dict
    if _DICT_PATH.exists():
        try:
            with open(_DICT_PATH, "r", encoding="utf-8") as f:
                _personal_dict = json.load(f)
            logger.info("Loaded personal dictionary: %d entries", len(_personal_dict))
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Failed to load personal dictionary: %s", exc)
            _personal_dict = {}
    else:
        _personal_dict = {}


def _save() -> None:
    """Persist the personal dictionary to disk."""
    try:
        _DICT_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(_DICT_PATH, "w", encoding="utf-8") as f:
            json.dump(_personal_dict, f, indent=2, ensure_ascii=False)
    except OSError as exc:
        logger.error("Failed to save personal dictionary: %s", exc)


# Initialize on import
_load()


def learn(wrong: str, correct: str) -> bool:
    """
    Record a user correction.

    Parameters
    ----------
    wrong : str
        The original (misrecognized/miscorrected) word.
    correct : str
        The word the user corrected it to.

    Returns True if successfully learned.
    """
    if not wrong or not correct:
        return False
    if wrong.strip().lower() == correct.strip().lower():
        return False  # No actual correction

    key = wrong.strip().lower()
    with _lock:
        _personal_dict[key] = correct.strip()
        _save()

    logger.info("Learned: '%s' → '%s'", wrong, correct)
    return True


def lookup(word: str) -> str | None:
    """
    Look up a word in the personal dictionary.

    Returns the learned correction if it exists, else None.
    """
    if not word:
        return None
    key = word.strip().lower()
    with _lock:
        return _personal_dict.get(key)


def apply_personal_corrections(text: str) -> str:
    """
    Apply all personal dictionary corrections to a text string.

    Checks each word against the personal dictionary and replaces
    matches with the learned correction, preserving case pattern.
    """
    if not text or not _personal_dict:
        return text

    words = text.split()
    result = []

    for word in words:
        correction = lookup(word)
        if correction is not None:
            # Preserve case pattern from original
            if word.isupper():
                result.append(correction.upper())
            elif word and word[0].isupper():
                result.append(correction[0].upper() + correction[1:])
            else:
                result.append(correction)
        else:
            result.append(word)

    return " ".join(result)


def get_all_entries() -> dict[str, str]:
    """Return a copy of the full personal dictionary."""
    with _lock:
        return dict(_personal_dict)


def delete_entry(wrong: str) -> bool:
    """Remove a single entry from the personal dictionary."""
    key = wrong.strip().lower()
    with _lock:
        if key in _personal_dict:
            del _personal_dict[key]
            _save()
            return True
    return False


def clear_all() -> int:
    """Clear the entire personal dictionary. Returns count of removed entries."""
    with _lock:
        count = len(_personal_dict)
        _personal_dict.clear()
        _save()
    return count
