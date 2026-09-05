"""Shared fixtures: make the service importable and render synthetic character images."""

from __future__ import annotations

import io
import os
import sys

import pytest
from PIL import Image, ImageDraw

SERVICE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVICE_DIR not in sys.path:
    sys.path.insert(0, SERVICE_DIR)

# Keep test runs from polluting the real personal dictionary.
os.environ.setdefault("AIRSCRIPT_PERSONAL_DICT_PATH", os.path.join(SERVICE_DIR, "data", "personal_dictionary.test.json"))

CANVAS_W, CANVAS_H = 640, 480
STROKE_COLOR = (0, 229, 255, 255)  # the client's default cyan on a transparent canvas


def render_strokes(strokes: list[list[tuple[int, int]]], width: int = 6) -> bytes:
    """Draw polylines the way the browser canvas does and return PNG bytes (RGBA, transparent bg)."""
    img = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    for pts in strokes:
        if len(pts) == 1:
            x, y = pts[0]
            draw.ellipse((x - width, y - width, x + width, y + width), fill=STROKE_COLOR)
        else:
            draw.line(pts, fill=STROKE_COLOR, width=width, joint="curve")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def png_vertical_bar() -> bytes:
    """A tall vertical stroke — reads as '1' / 'I'."""
    return render_strokes([[(320, 120), (320, 360)]], width=10)


@pytest.fixture
def png_circle() -> bytes:
    """A closed loop — reads as 'O' / '0'."""
    import math

    pts = [(320 + int(90 * math.cos(t / 40 * 2 * math.pi)), 240 + int(110 * math.sin(t / 40 * 2 * math.pi))) for t in range(41)]
    return render_strokes([pts], width=10)


@pytest.fixture
def png_blank() -> bytes:
    return render_strokes([])
