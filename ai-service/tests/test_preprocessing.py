"""Pins the behaviour of the 10-step preprocessing pipeline the CNN was trained against."""

import numpy as np

from preprocessing import preprocess_image


def test_output_shape_dtype_and_range(png_vertical_bar):
    out = preprocess_image(png_vertical_bar)
    assert out is not None
    assert out.shape == (28, 28)
    assert out.dtype == np.float32
    assert out.min() >= 0.0 and out.max() <= 1.0


def test_white_on_black_convention(png_circle):
    out = preprocess_image(png_circle)
    # Background dominates and is dark; the stroke is bright.
    assert out.mean() < 0.5
    assert out.max() > 0.9


def test_content_is_centred_and_padded(png_vertical_bar):
    out = preprocess_image(png_vertical_bar)
    ys, xs = np.nonzero(out > 0.5)
    # Auto-crop + square padding should centre the glyph horizontally...
    assert abs(xs.mean() - 13.5) < 2.0
    # ...and the 20% padding keeps it off the edges.
    assert ys.min() >= 2 and ys.max() <= 25


def test_thin_stroke_is_not_treated_as_blank():
    from tests.conftest import render_strokes

    thin = render_strokes([[(200, 100), (400, 380)]], width=2)
    out = preprocess_image(thin)
    assert out is not None
    assert out.max() > 0.0


def test_blank_image_returns_none(png_blank):
    assert preprocess_image(png_blank) is None


def test_deterministic(png_circle):
    a = preprocess_image(png_circle)
    b = preprocess_image(png_circle)
    assert np.array_equal(a, b)
