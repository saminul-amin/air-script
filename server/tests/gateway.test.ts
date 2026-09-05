/**
 * The gateway must forward requests to the AI service and surface upstream
 * errors (status + message) instead of swallowing them.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

type Handler = (req: http.IncomingMessage, body: Buffer, res: http.ServerResponse) => void;

let upstreamHandler: Handler = (_req, _body, res) => {
  res.writeHead(500);
  res.end();
};

const upstream = http.createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(c));
  req.on("end", () => upstreamHandler(req, Buffer.concat(chunks), res));
});

let gateway: http.Server;
let gatewayUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const { port } = upstream.address() as AddressInfo;
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${port}`;
  process.env.UPSTREAM_TIMEOUT_MS = "5000";

  const { default: app } = await import("../src/app");
  gateway = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => gateway.once("listening", resolve));
  gatewayUrl = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
});

afterAll(async () => {
  gateway.closeAllConnections();
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
  upstream.closeAllConnections();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

describe("gateway proxy", () => {
  it("forwards JSON bodies and returns the upstream response", async () => {
    let seenPath = "";
    let seenBody = "";
    upstreamHandler = (req, body, res) => {
      seenPath = req.url ?? "";
      seenBody = body.toString();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ raw_text: "helo", corrected_text: "Hello", stages: {} }));
    };

    const res = await fetch(`${gatewayUrl}/api/process-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_characters: [{ label: "h", confidence: 0.9, top3: ["h"], pause_before_ms: 0 }],
      }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ raw_text: "helo", corrected_text: "Hello", stages: {} });
    expect(seenPath).toBe("/process-text");
    expect(JSON.parse(seenBody).raw_characters[0].label).toBe("h");
  });

  it("streams multipart uploads through to /predict-character", async () => {
    let seenContentType = "";
    let seenBytes = 0;
    upstreamHandler = (req, body, res) => {
      seenContentType = String(req.headers["content-type"]);
      seenBytes = body.length;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ prediction: "A", confidence: 0.91, top3: ["A", "R", "H"] }));
    };

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(1024)], { type: "image/png" }), "drawing.png");
    const res = await fetch(`${gatewayUrl}/api/predict-character`, { method: "POST", body: form });

    expect(res.status).toBe(200);
    expect((await res.json()).prediction).toBe("A");
    expect(seenContentType).toContain("multipart/form-data");
    expect(seenBytes).toBeGreaterThan(1024);
  });

  it("surfaces upstream error status and detail (e.g. model not loaded)", async () => {
    upstreamHandler = (_req, _body, res) => {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ detail: "Character model is not loaded" }));
    };

    const res = await fetch(`${gatewayUrl}/api/suggest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "he", context: "", limit: 5 }),
    });

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Character model is not loaded");
    expect(body.upstreamStatus).toBe(503);
  });

  it("answers 502 with a clear message when the AI service is unreachable", async () => {
    // Find a port that is closed by opening and immediately closing a server on it.
    const dead = http.createServer();
    await new Promise<void>((resolve) => dead.listen(0, "127.0.0.1", resolve));
    const { port } = dead.address() as AddressInfo;
    await new Promise<void>((resolve) => dead.close(() => resolve()));

    const saved = process.env.AI_SERVICE_URL;
    process.env.AI_SERVICE_URL = `http://127.0.0.1:${port}`;
    try {
      const res = await fetch(`${gatewayUrl}/api/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "he", context: "", limit: 5 }),
      });
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toMatch(/unreachable/i);
      expect(body.upstreamStatus).toBeUndefined();
    } finally {
      process.env.AI_SERVICE_URL = saved;
    }
  });

  it("reports upstream model status on /api/health", async () => {
    upstreamHandler = (_req, _body, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: "4.1.0", model: { loaded: true, num_classes: 47 } }));
    };

    const res = await fetch(`${gatewayUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.ai.reachable).toBe(true);
    expect(body.ai.model.loaded).toBe(true);
  });
});
