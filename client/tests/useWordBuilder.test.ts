import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/api", () => ({
  recognizeCharacter: vi.fn(),
  processText: vi.fn(),
}));

import { recognizeCharacter, processText } from "../src/utils/api";
import useWordBuilder from "../src/hooks/useWordBuilder";

const recognize = vi.mocked(recognizeCharacter);
const process = vi.mocked(processText);

function setup() {
  const getSnapshot = vi.fn(async () => new Blob([new Uint8Array(8)], { type: "image/png" }));
  const clearCanvas = vi.fn();
  const hook = renderHook(() => useWordBuilder(getSnapshot, clearCanvas));
  return { ...hook, getSnapshot, clearCanvas };
}

beforeEach(() => {
  vi.useFakeTimers();
  recognize.mockReset();
  process.mockReset();
  process.mockImplementation(async (chars) => {
    const raw = chars.map((c) => c.label).join("");
    return { raw_text: raw, corrected_text: raw.toLowerCase(), stages: {} };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWordBuilder", () => {
  it("recognises a character after the pause and appends it to the word", async () => {
    recognize.mockResolvedValue({ prediction: "H", confidence: 0.93, top3: ["H", "N", "M"] });
    const { result, getSnapshot, clearCanvas } = setup();

    act(() => {
      result.current.onStroke();
      result.current.onDrawingStop();
    });
    expect(recognize).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(result.current.word).toHaveLength(1);
    expect(result.current.word[0]).toMatchObject({ label: "H", confidence: 0.93, top3: ["H", "N", "M"] });
    expect(result.current.wordString).toBe("H");
    expect(result.current.lastResult?.prediction).toBe("H");
    expect(clearCanvas).toHaveBeenCalled();
  });

  it("measures the pause from stroke timestamps, not from the network reply", async () => {
    let resolveSecond: (v: { prediction: string; confidence: number; top3: string[] }) => void = () => {};
    recognize
      .mockResolvedValueOnce({ prediction: "H", confidence: 0.9, top3: ["H"] })
      .mockImplementationOnce(() => new Promise((res) => (resolveSecond = res)));
    const { result } = setup();

    // First character.
    act(() => {
      result.current.onStroke();
      result.current.onDrawingStop();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.word[0].pauseBeforeMs).toBe(0);

    // 400 ms idle, then the second character; its request takes 5 s to answer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    act(() => {
      result.current.onStroke();
      result.current.onDrawingStop();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
      resolveSecond({ prediction: "I", confidence: 0.8, top3: ["I"] });
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.word).toHaveLength(2);
    // Idle = 1000 ms auto-recognition wait + 400 ms; the 5 s network wait must not count.
    expect(result.current.word[1].pauseBeforeMs).toBe(1400);
  });

  it("can ignore pauses (used by sample replay)", async () => {
    recognize.mockResolvedValue({ prediction: "A", confidence: 0.9, top3: ["A"] });
    const { result } = setup();
    act(() => result.current.setIgnorePauses(true));
    for (let i = 0; i < 2; i++) {
      act(() => {
        result.current.onStroke();
        result.current.onDrawingStop();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
    }
    expect(result.current.word.map((c) => c.pauseBeforeMs)).toEqual([0, 0]);
  });

  it("does not recognise when the pen lifts without new strokes", async () => {
    const { result } = setup();
    act(() => result.current.onDrawingStop());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(recognize).not.toHaveBeenCalled();
  });

  it("runs correction immediately at a word boundary and lazily otherwise", async () => {
    const { result } = setup();

    act(() => result.current.injectChar("H"));
    act(() => result.current.injectChar("E"));
    expect(process).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(process).toHaveBeenCalledTimes(1);
    expect(result.current.correctedText).toBe("he");

    await act(async () => {
      result.current.addSpace();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(process).toHaveBeenCalledTimes(2);
    expect(result.current.wordString).toBe("HE ");
  });

  it("undoLastChar removes the last character and re-corrects", async () => {
    const { result } = setup();
    act(() => result.current.injectChar("A"));
    act(() => result.current.injectChar("B"));
    await act(async () => {
      result.current.undoLastChar();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.wordString).toBe("A");
    expect(process).toHaveBeenLastCalledWith([expect.objectContaining({ label: "A" })]);
  });

  it("surfaces recognition errors instead of swallowing them", async () => {
    recognize.mockRejectedValue(new Error("Character model is not loaded"));
    const { result } = setup();
    await act(async () => {
      await result.current.recognizeNow();
    });
    expect(result.current.error).toBe("Character model is not loaded");
    expect(result.current.word).toHaveLength(0);
  });

  it("clearAll resets text, canvas and pending timers", async () => {
    const { result, clearCanvas } = setup();
    act(() => result.current.injectChar("Z"));
    act(() => result.current.clearAll());
    expect(result.current.word).toHaveLength(0);
    expect(result.current.correctedText).toBe("");
    expect(clearCanvas).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(process).not.toHaveBeenCalled();
  });
});
