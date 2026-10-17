"""
Contact sheet of BanglaLekha-Isolated: a few samples from each of the 84
class folders, captioned with the folder number, so the folder → Unicode
mapping in model_bn.py can be checked by eye.

    python tools/bn_contact_sheet.py [--out path.png] [--per 3]
"""

from __future__ import annotations

import argparse
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from preprocessing_bn import find_images_root  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.join(HERE, "bn_contact_sheet.png"))
    parser.add_argument("--per", type=int, default=3)
    args = parser.parse_args(argv)

    root = find_images_root()
    cell, cols = 72, 12
    rows = (84 + cols - 1) // cols
    sheet = Image.new("L", (cols * cell * args.per, rows * (cell + 14)), 20)
    draw = ImageDraw.Draw(sheet)
    for cls in range(1, 85):
        folder = os.path.join(root, str(cls))
        files = sorted(f for f in os.listdir(folder) if f.lower().endswith((".png", ".jpg")))
        r, c = divmod(cls - 1, cols)
        x0, y0 = c * cell * args.per, r * (cell + 14)
        draw.text((x0 + 2, y0), f"{cls}", fill=255)
        for k, name in enumerate(files[: args.per]):
            im = Image.open(os.path.join(folder, name)).convert("L")
            im.thumbnail((cell - 4, cell - 4))
            sheet.paste(im, (x0 + k * cell + 2, y0 + 14))
    sheet.save(args.out)
    print(f"wrote {args.out}")
    sample = sorted(os.listdir(os.path.join(root, "1")))[0]
    im = Image.open(os.path.join(root, "1", sample))
    print(f"example file {sample}: mode {im.mode}, size {im.size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
