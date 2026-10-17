/**
 * useWordBuilder in Bengali: nothing goes to the correction service; the line
 * is composed on the device with the vowel-sign rule.
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

import { processText } from "../src/utils/api";
import useWordBuilder from "../src/hooks/useWordBuilder";

const serverProcess = vi.mocked(processText);

beforeEach(() => {
  vi.useFakeTimers();
  serverProcess.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useWordBuilder in Bengali", () => {
  it("composes বাংলা from ব আ ং ল আ without calling the server", async () => {
    const { result } = renderHook(() => useWordBuilder(vi.fn(), vi.fn(), undefined, "bn"));
    for (const ch of ["ব", "আ", "ং", "ল", "আ"]) act(() => result.current.injectChar(ch));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(serverProcess).not.toHaveBeenCalled();
    expect(result.current.rawText).toBe("বআংলআ");
    expect(result.current.correctedText).toBe("বাংলা");
    expect(result.current.correctionStatus).toBe("skipped");
    expect(result.current.isProcessing).toBe(false);
  });

  it("keeps a word-initial vowel independent and digits as they are", async () => {
    const { result } = renderHook(() => useWordBuilder(vi.fn(), vi.fn(), undefined, "bn"));
    for (const ch of ["এ", "ক", " ", "২", "০"]) act(() => result.current.injectChar(ch));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.correctedText).toBe("এক ২০");
  });

  it("still corrects through the server in English", async () => {
    serverProcess.mockResolvedValue({ raw_text: "HI", corrected_text: "hi", stages: {} });
    const { result } = renderHook(() => useWordBuilder(vi.fn(), vi.fn(), undefined, "en"));
    act(() => result.current.injectChar("H"));
    act(() => result.current.injectChar("I"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(serverProcess).toHaveBeenCalledTimes(1);
    expect(result.current.correctedText).toBe("hi");
  });
});
