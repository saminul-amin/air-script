// @vitest-environment node
/**
 * The ONNX files the browser downloads from public/models must be the exact
 * exports committed in ai-service/saved_model (pinned by their .sha256 files).
 * Re-copy after re-running export_onnx.py; this test fails if the two drift.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_MODELS = path.resolve(__dirname, "../public/models");
const SERVICE_MODELS = path.resolve(__dirname, "../../ai-service/saved_model");

const models = fs.readdirSync(CLIENT_MODELS).filter((f) => f.endsWith(".onnx")).sort();

describe("public/models mirrors ai-service/saved_model", () => {
  it("ships at least one ONNX model", () => {
    expect(models.length).toBeGreaterThan(0);
  });

  for (const name of models) {
    it(`${name} matches the checksum pinned next to the ai-service export`, () => {
      const pinned = fs.readFileSync(path.join(SERVICE_MODELS, `${name}.sha256`), "utf-8").trim().split(/\s+/)[0];
      const actual = crypto.createHash("sha256").update(fs.readFileSync(path.join(CLIENT_MODELS, name))).digest("hex");
      expect(actual).toBe(pinned);
    });
  }
});
