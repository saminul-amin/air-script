"""
Turn printed Bengali glyphs into stroke polylines for the client's sample replays.

    python tools/bn_glyph_strokes.py ব আ ং ল ক ম ২ ০ ৬ > strokes.json

Renders each character with a Bengali system font (through the client's
@napi-rs/canvas), thins the ink to a one-pixel skeleton (Zhang–Suen), follows
the skeleton into polylines, simplifies them (Ramer–Douglas–Peucker) and
scales them into the 200 × 260 glyph box used by client/src/data/samples.ts.
The output is JSON: {char: [[{x, y}, ...], ...]}.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from bn_check_compounds import render  # noqa: E402

BOX_W, BOX_H = 200, 260


def zhang_suen(img: np.ndarray) -> np.ndarray:
    img = (img > 0).astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            p = np.pad(img, 1)
            P2, P3, P4 = p[:-2, 1:-1], p[:-2, 2:], p[1:-1, 2:]
            P5, P6, P7 = p[2:, 2:], p[2:, 1:-1], p[2:, :-2]
            P8, P9 = p[1:-1, :-2], p[:-2, :-2]
            neighbours = [P2, P3, P4, P5, P6, P7, P8, P9]
            B = sum(n.astype(int) for n in neighbours)
            A = sum(((neighbours[i] == 0) & (neighbours[(i + 1) % 8] == 1)).astype(int) for i in range(8))
            if step == 0:
                c1, c2 = P2 * P4 * P6, P4 * P6 * P8
            else:
                c1, c2 = P2 * P4 * P8, P2 * P6 * P8
            remove = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & (c1 == 0) & (c2 == 0)
            if remove.any():
                img[remove] = 0
                changed = True
    return img


def follow_paths(skel: np.ndarray) -> list[list[tuple[int, int]]]:
    pts = {(int(y), int(x)) for y, x in zip(*np.nonzero(skel))}
    nbrs = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0] + dy, p[1] + dx) in pts]
    paths = []
    while pts:
        # start from an endpoint if any, otherwise anywhere
        start = next((p for p in pts if len(nbrs(p)) == 1), next(iter(pts)))
        path = [start]
        pts.discard(start)
        cur = start
        while True:
            nxt = nbrs(cur)
            if not nxt:
                break
            cur = min(nxt, key=lambda q: (abs(q[0] - cur[0]) + abs(q[1] - cur[1])))
            path.append(cur)
            pts.discard(cur)
        if len(path) >= 6:
            paths.append(path)
    return paths


def rdp(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1])
    ab = b - a
    norm = np.linalg.norm(ab) or 1.0
    d = [abs(ab[0] * (p[1] - a[1]) - ab[1] * (p[0] - a[0])) / norm for p in points[1:-1]]
    i = int(np.argmax(d)) + 1
    if d[i - 1] > eps:
        return rdp(points[: i + 1], eps)[:-1] + rdp(points[i:], eps)
    return [points[0], points[-1]]


def main(argv: list[str]) -> int:
    chars = argv or ["ব", "আ", "ং", "ল", "ক", "ম", "২", "০", "৬"]
    out: dict[str, list[list[dict[str, float]]]] = {}
    with tempfile.TemporaryDirectory() as tmp:
        render(tmp, chars)
        for i, ch in enumerate(chars):
            img = np.array(Image.open(os.path.join(tmp, f"{i}.png")).convert("L")) > 128
            ys, xs = np.nonzero(img)
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            crop = img[y0:y1, x0:x1]
            skel = zhang_suen(crop)
            h, w = crop.shape
            scale = min((BOX_W - 20) / w, (BOX_H - 20) / h)
            ox, oy = (BOX_W - w * scale) / 2, (BOX_H - h * scale) / 2
            strokes = []
            for path in follow_paths(skel):
                pts = [(x * scale + ox, y * scale + oy) for y, x in path]
                simplified = rdp(pts, 2.5)
                strokes.append([{"x": round(x, 1), "y": round(y, 1)} for x, y in simplified])
            strokes.sort(key=lambda s: -len(s))
            out[ch] = strokes
            print(f"{ch}: {len(strokes)} stroke(s), {sum(len(s) for s in strokes)} points", file=sys.stderr)
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
