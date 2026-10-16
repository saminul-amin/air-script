/**
 * useWordBuilder with on-device recognition and an unreachable correction
 * service: characters still appear, the server is only a fallback, and a
 * pending correction is retried when the service is back (a bounded number of
 * times).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/utils/api", () => ({
  recognizeCharacter: vi.fn(),
  processText: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { ApiError, recognizeCharacter, processText } from "../src/utils/api";
import useWordBuilder, { type LocalRecognition } from "../src/hooks/useWordBuilder";

const serverRecognize = vi.mocked(recognizeCharacter);
const serverProcess = vi.mocked(processText);

const pixels = { data: new Uint8ClampedArray(16), width: 2, height: 2 } as unknown as ImageData;

function setup(local?: Partial<LocalRecognition>) {
  const getSnapshot = vi.fn(async () => new Blob([new Uint8Array(8)], { type: "image/png" }));
  const clearCanvas = vi.fn();
  const localRecognition: LocalRecognition | undefined = local
    ? { getSnapshotPixels: local.getSnapshotPixels ?? vi.fn(() => pixels), recognize: local.recognize ?? vi.fn() }
    : undefined;
  const hook = renderHook(() => useWordBuilder(getSnapshot, clearCanvas, localRecognition));
  return { ...hook, getSnapshot, clearCanvas, local: localRecognition };
}

async function drawOneCharacter(result: { current: ReturnType<typeof useWordBuilder> }) {
  act(() => {
    result.current.onStroke();
    result.current.onDrawingStop();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  serverRecognize.mockReset();
  serverProcess.mockReset();
  serverProcess.mockImplementation(async (chars) => {
    const raw = chars.map((c) => c.label).join("");
    return { raw_text: raw, corrected_text: raw.toLowerCase(), stages: {} };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("on-device recognition", () => {
  it("recognises on the device and never calls the server", async () => {
    const recognize = vi.fn(async () => ({ prediction: "H", confidence: 0.91, top3: ["H", "N", "M"], top3_confidences: [0.91, 0.05, 0.02] }));
    const { result, getSnapshot, local } = setup({ recognize });

    await drawOneCharacter(result);

    expect(local!.getSnapshotPixels).toHaveBeenCalledTimes(1);
    expect(recognize).toHaveBeenCalledWith(pixels);
    expect(serverRecognize).not.toHaveBeenCalled();
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(result.current.word.map((c) => c.label)).toEqual(["H"]);
    expect(result.current.lastSource).toBe("device");
  });

  it("falls back to the server when on-device recognition is unavailable", async () => {
    const recognize = vi.fn(async () => undefined);
    serverRecognize.mockResolvedValue({ prediction: "E", confidence: 0.8, top3: ["E", "F", "B"] });
    const { result, getSnapshot } = setup({ recognize });

    await drawOneCharacter(result);

    expect(recognize).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(serverRecognize).toHaveBeenCalledTimes(1);
    expect(result.current.word.map((c) => c.label)).toEqual(["E"]);
    expect(result.current.lastSource).toBe("server");
  });

  it("falls back to the server when the on-device run throws", async () => {
    const recognize = vi.fn(async () => {
      throw new Error("wasm trap");
    });
    serverRecognize.mockResolvedValue({ prediction: "L", confidence: 0.7, top3: ["L", "I", "1"] });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = setup({ recognize });

    await drawOneCharacter(result);

    expect(serverRecognize).toHaveBeenCalledTimes(1);
    expect(result.current.word.map((c) => c.label)).toEqual(["L"]);
    expect(result.current.error).toBeNull();
    warn.mockRestore();
  });

  it("appends nothing when the device says the canvas is blank", async () => {
    const recognize = vi.fn(async () => null);
    const { result } = setup({ recognize });

    await drawOneCharacter(result);

    expect(serverRecognize).not.toHaveBeenCalled();
    expect(result.current.word).toHaveLength(0);
  });

  it("reports an empty canvas when asked to recognise now", async () => {
    const { result } = setup({ getSnapshotPixels: vi.fn(() => null) });
    await act(async () => {
      await result.current.recognizeNow();
    });
    expect(result.current.error).toBe("Canvas is empty");
  });
});

describe("correction while the service is unreachable", () => {
  it("shows raw text, marks the correction unavailable, and applies it on retry", async () => {
    serverProcess.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = setup();

    act(() => result.current.injectChar("H"));
    act(() => result.current.injectChar("I"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.correctedText).toBe("HI");
    expect(result.current.correctionStatus).toBe("unavailable");

    await act(async () => {
      result.current.retryCorrection();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(serverProcess).toHaveBeenCalledTimes(2);
    expect(result.current.correctedText).toBe("hi");
    expect(result.current.correctionStatus).toBe("applied");
  });

  it("treats gateway 5xx answers as unreachable and 4xx as a failure", async () => {
    serverProcess.mockRejectedValueOnce(new ApiError(503, "upstream asleep"));
    const { result } = setup();
    act(() => result.current.injectChar("A"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.correctionStatus).toBe("unavailable");

    serverProcess.mockRejectedValueOnce(new ApiError(422, "bad payload"));
    await act(async () => {
      result.current.retryCorrection();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.correctionStatus).toBe("failed");
    expect(result.current.correctedText).toBe("A");

    // Nothing pending any more: a retry is a no-op.
    await act(async () => {
      result.current.retryCorrection();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(serverProcess).toHaveBeenCalledTimes(2);
  });

  it("stops retrying a correction after a bounded number of attempts", async () => {
    serverProcess.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = setup();
    act(() => result.current.injectChar("B"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.correctionStatus).toBe("unavailable");

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        result.current.retryCorrection();
        await vi.advanceTimersByTimeAsync(0);
      });
    }
    // First try + two retries, then it gives up and the third retry is a no-op.
    expect(serverProcess).toHaveBeenCalledTimes(3);
    expect(result.current.correctionStatus).toBe("failed");
  });

  it("clears the pending correction with everything else", async () => {
    serverProcess.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = setup();
    act(() => result.current.injectChar("C"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.correctionStatus).toBe("unavailable");

    act(() => result.current.clearAll());
    expect(result.current.correctionStatus).toBe("idle");
    await act(async () => {
      result.current.retryCorrection();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(serverProcess).toHaveBeenCalledTimes(1);
  });
});
