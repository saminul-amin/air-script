/**
 * The dev-only stroke recorder: a balanced prompt order, one saved sample per
 * "Save & next" with the strokes and the snapshot PNG, and an export of
 * everything as versioned JSON.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useRecorder from "../src/hooks/useRecorder";
import { EMNIST_LABELS } from "../src/recognition/labels";
import { RECORD_SAMPLES_PER_CLASS } from "../src/config";

const stroke = { points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: "#1c1f27", width: 4 };

function setup(strokes = [stroke]) {
  const targets = {
    getStrokes: vi.fn(() => strokes),
    getSnapshot: vi.fn(async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })),
    clearCanvas: vi.fn(),
  };
  return { ...renderHook(() => useRecorder(targets)), targets };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("useRecorder", () => {
  it("prompts every class the same number of times, one shuffled pass per round", () => {
    const { result } = setup();
    expect(result.current.total).toBe(EMNIST_LABELS.length * RECORD_SAMPLES_PER_CLASS);
    expect(EMNIST_LABELS).toContain(result.current.target);
  });

  it("saves the strokes and the PNG under the target label, then advances", async () => {
    const { result, targets } = setup();
    const first = result.current.target!;

    await act(async () => {
      await result.current.saveAndNext();
    });

    expect(result.current.savedCount).toBe(1);
    expect(result.current.lastSaved).toBe(first);
    expect(result.current.cursor).toBe(1);
    expect(targets.clearCanvas).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(localStorage.getItem("airscript.recorder.v1")!);
    expect(stored.samples).toHaveLength(1);
    expect(stored.samples[0].label).toBe(first);
    expect(stored.samples[0].strokes).toEqual([stroke]);
    expect(typeof stored.samples[0].png).toBe("string");
    expect(stored.samples[0].png.length).toBeGreaterThan(0);
  });

  it("does nothing on save when the paper is empty", async () => {
    const { result, targets } = setup([]);
    await act(async () => {
      await result.current.saveAndNext();
    });
    expect(result.current.savedCount).toBe(0);
    expect(targets.getSnapshot).not.toHaveBeenCalled();
  });

  it("skips without saving and can undo the last save", async () => {
    const { result } = setup();
    act(() => result.current.skip());
    expect(result.current.cursor).toBe(1);
    expect(result.current.savedCount).toBe(0);

    await act(async () => {
      await result.current.saveAndNext();
    });
    expect(result.current.savedCount).toBe(1);
    act(() => result.current.undoLast());
    expect(result.current.savedCount).toBe(0);
    expect(result.current.cursor).toBe(1);
  });

  it("resumes from the saved samples after a reload", async () => {
    const first = setup();
    await act(async () => {
      await first.result.current.saveAndNext();
    });
    first.unmount();

    const second = setup();
    expect(second.result.current.savedCount).toBe(1);
    expect(second.result.current.cursor).toBe(1);
  });

  it("exports a versioned JSON set", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.saveAndNext();
    });
    const createObjectURL = vi.fn((_blob: Blob) => "blob:test");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    act(() => result.current.exportJson());

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    // jsdom's Blob has no text(); go through FileReader like a browser would.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const set = JSON.parse(text);
    expect(set.version).toBe(1);
    expect(set.labels).toEqual([...EMNIST_LABELS]);
    expect(set.samples).toHaveLength(1);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
