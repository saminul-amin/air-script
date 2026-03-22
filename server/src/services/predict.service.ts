import { Request } from "express";
import { AIServiceError } from "../types";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

/**
 * Forward the raw request to the FastAPI AI service.
 * Streams the request body as-is (multipart/form-data).
 */
export const forwardToAI = async (
  req: Request,
  endpoint: string = "/predict"
): Promise<unknown> => {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (key !== "host" && typeof value === "string") {
      headers[key] = value;
    }
  }

  const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: req as unknown as BodyInit,
    duplex: "half",
  } as RequestInit);

  if (!response.ok) {
    const err: AIServiceError = new Error(
      `AI service responded with ${response.status}`
    );
    err.status = response.status;
    throw err;
  }

  return response.json();
};

/**
 * Forward a JSON body to the FastAPI AI service.
 */
export const forwardJSON = async (
  body: unknown,
  endpoint: string
): Promise<unknown> => {
  const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err: AIServiceError = new Error(
      `AI service responded with ${response.status}`
    );
    err.status = response.status;
    throw err;
  }

  return response.json();
};
