"""Known misspelling in, known correction out."""

from correction.context_rules import disambiguate_characters, merge_dots
from correction.pipeline import process_characters
from correction.punctuation import format_text
from correction.spell_corrector import correct_text, correct_word, is_valid_word


def _chars(text: str, confidence: float = 0.6) -> list[dict]:
    return [{"label": c, "confidence": 1.0 if c == " " else confidence, "top3": [c], "pause_before_ms": 0} for c in text]


def test_spell_corrector_fixes_common_misspellings():
    assert correct_word("teh") == "the"
    assert correct_word("wolrd") == "world"
    assert correct_word("recieve") == "receive"
    assert correct_text("teh wolrd") == "the world"


def test_spell_corrector_keeps_valid_words_and_numbers():
    assert correct_text("hello 2024") == "hello 2024"
    assert is_valid_word("hello")
    assert not is_valid_word("qzxv")


def test_short_word_ocr_fixes():
    assert correct_word("1s") == "is"
    assert correct_word("t0") == "to"


def test_disambiguation_uses_alpha_context():
    out = disambiguate_characters(_chars("W0RD", confidence=0.5))
    assert "".join(c["label"] for c in out) == "WORD"
    assert out[1].get("corrected") is True


def test_disambiguation_uses_digit_context():
    out = disambiguate_characters(_chars("9O5", confidence=0.5))
    assert "".join(c["label"] for c in out) == "905"


def test_leading_one_before_letters_becomes_capital_i():
    out = disambiguate_characters(_chars("1t", confidence=0.5))
    assert "".join(c["label"] for c in out) == "It"


def test_confident_characters_are_left_alone():
    out = disambiguate_characters(_chars("W0RD", confidence=0.99))
    assert "".join(c["label"] for c in out) == "W0RD"


def test_dot_merge_turns_l_plus_dot_into_i():
    chars = _chars("h", 0.9) + _chars("l", 0.6) + [{"label": ".", "confidence": 0.3, "top3": ["."], "pause_before_ms": 0}]
    out = merge_dots(chars)
    assert "".join(c["label"] for c in out) == "hi"


def test_format_text_capitalises_sentences_and_standalone_i():
    assert format_text("helLo world. i am here") == "Hello world. I am here"
    assert format_text("hello world") == "Hello world"
    assert format_text("i am fine") == "I am fine"


def test_pause_punctuation_inserts_a_period_and_formats_cleanly():
    chars = _chars("hello", 0.9) + [{"label": "t", "confidence": 0.9, "top3": ["t"], "pause_before_ms": 2000}] + _chars("here", 0.9)
    result = process_characters(chars)
    assert result["corrected_text"] == "Hello. There"


def test_pipeline_end_to_end_known_input():
    result = process_characters(_chars("teh wolrd"))
    assert result["raw_text"] == "teh wolrd"
    assert result["corrected_text"] == "The world"
    assert result["stages"]["after_spell_correction"] == "the world"


def test_pipeline_empty_input():
    result = process_characters([])
    assert result["raw_text"] == ""
    assert result["corrected_text"] == ""
