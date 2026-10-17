// @vitest-environment node
/**
 * The numbers the "How it works" panel shows must be the ones in
 * docs/accuracy-*.json, byte for byte: regenerate with `npm run sync:accuracy`.
 */
import { describe, expect, it } from "vitest";
import { isStale } from "../scripts/accuracy-sync-lib";

describe("accuracy data shown in the app", () => {
  it("matches docs/accuracy-*.json and the confusion-matrix images", () => {
    expect(isStale()).toEqual([]);
  });
});
