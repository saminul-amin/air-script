import { describe, expect, it } from "vitest";
import { buildProcessTextPayload, forRecognition, RECOGNITION_INK } from "../src/utils/strokePayload";
import { validateStroke, shouldAttachDot, getBoundingBox } from "../src/utils/strokeValidator";
import { catmullRomSmooth } from "../src/utils/drawing";
import type { RecognizedChar } from "../src/types";

describe("buildProcessTextPayload", () => {
  it("maps client characters to the AI service's snake_case body", () => {
    const chars: RecognizedChar[] = [
      { label: "h", confidence: 0.91, top3: ["h", "n", "b"], pauseBeforeMs: 0 },
      { label: " ", confidence: 1, top3: [" "], pauseBeforeMs: 0 },
      { label: "1", confidence: 0.42, top3: ["1", "I", "l"], pauseBeforeMs: 1800.4 },
    ];

    expect(buildProcessTextPayload(chars)).toEqual({
      raw_characters: [
        { label: "h", confidence: 0.91, top3: ["h", "n", "b"], pause_before_ms: 0 },
        { label: " ", confidence: 1, top3: [" "], pause_before_ms: 0 },
        { label: "1", confidence: 0.42, top3: ["1", "I", "l"], pause_before_ms: 1800 },
      ],
    });
  });

  it("normalises missing or invalid fields so the server never sees undefined", () => {
    const chars = [{ label: "A", confidence: Number.NaN, top3: [], pauseBeforeMs: undefined }] as unknown as RecognizedChar[];
    expect(buildProcessTextPayload(chars).raw_characters[0]).toEqual({
      label: "A",
      confidence: 0,
      top3: ["A"],
      pause_before_ms: 0,
    });
  });
});

describe("forRecognition", () => {
  it("repaints every stroke in bright ink and keeps geometry and widths", () => {
    const strokes = [
      { points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: "#1c1f27", width: 4, widths: [4, 3.2] },
      { points: [{ x: 5, y: 6 }, { x: 7, y: 8 }], color: "#ff6a3d", width: 6 },
    ];
    const out = forRecognition(strokes);
    expect(out.every((s) => s.color === RECOGNITION_INK)).toBe(true);
    expect(out[0].points).toEqual(strokes[0].points);
    expect(out[0].widths).toEqual([4, 3.2]);
    expect(out[1].width).toBe(6);
    expect(strokes[0].color).toBe("#1c1f27"); // input untouched
  });
});

describe("stroke validation (what gets sent for recognition)", () => {
  const line = (n: number, dx = 4, dy = 3) => Array.from({ length: n }, (_, i) => ({ x: 100 + i * dx, y: 100 + i * dy }));

  it("accepts a normal stroke", () => {
    const r = validateStroke(line(30), 400);
    expect(r.valid).toBe(true);
    expect(r.isDot).toBe(false);
  });

  it("rejects too-fast taps and tiny scribbles as noise", () => {
    expect(validateStroke(line(30), 10).reason).toBe("too-fast");
    expect(validateStroke(line(2)).reason).toMatch(/points/);
  });

  it("classifies a tiny stroke as a dot rather than discarding it", () => {
    const dot = [{ x: 200, y: 50 }, { x: 201, y: 51 }, { x: 202, y: 50 }, { x: 201, y: 49 }, { x: 200, y: 50 }, { x: 201, y: 50 }];
    const r = validateStroke(dot, 200);
    expect(r.valid).toBe(false);
    expect(r.isDot).toBe(true);
  });

  it("attaches a dot only when it sits just above the previous stroke", () => {
    const stem = getBoundingBox(line(40, 0, 3)); // vertical stem at x=100, y 100..217
    const above = getBoundingBox([{ x: 99, y: 70 }, { x: 101, y: 72 }]);
    const farLeft = getBoundingBox([{ x: 10, y: 70 }, { x: 12, y: 72 }]);
    const below = getBoundingBox([{ x: 100, y: 240 }, { x: 102, y: 242 }]);
    expect(shouldAttachDot(above, stem)).toBe(true);
    expect(shouldAttachDot(farLeft, stem)).toBe(false);
    expect(shouldAttachDot(below, stem)).toBe(false);
    expect(shouldAttachDot(above, null)).toBe(false);
  });

  it("smoothing keeps endpoints and densifies the path", () => {
    const pts = line(5, 10, 0);
    const smooth = catmullRomSmooth(pts);
    expect(smooth[0]).toEqual(pts[0]);
    expect(smooth[smooth.length - 1]).toEqual(pts[pts.length - 1]);
    expect(smooth.length).toBeGreaterThan(pts.length);
  });
});
