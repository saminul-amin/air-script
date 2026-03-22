import { Request, Response } from "express";
import * as predictService from "../services/predict.service";
import { AIServiceError } from "../types";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

export const proxyPredict = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await predictService.forwardToAI(req);
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};

export const proxyPredictCharacter = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await predictService.forwardToAI(req, "/predict-character");
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};

export const proxyProcessText = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await predictService.forwardJSON(req.body, "/process-text");
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};

export const proxySuggest = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await predictService.forwardJSON(req.body, "/suggest");
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};

export const proxyAutocomplete = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await predictService.forwardJSON(req.body, "/autocomplete");
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};

export const proxyLearn = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await predictService.forwardJSON(req.body, "/learn");
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};

export const proxyPersonalDict = async (_req: Request, res: Response): Promise<void> => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/personal-dict`);
    if (!response.ok) {
      const err: AIServiceError = new Error(
        `AI service responded with ${response.status}`
      );
      err.status = response.status;
      throw err;
    }
    const result = await response.json();
    res.json(result);
  } catch (err) {
    const error = err as AIServiceError;
    const status = error.status || 502;
    res.status(status).json({ error: error.message || "AI service unavailable" });
  }
};
