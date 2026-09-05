import { Request, Response } from "express";
import * as predictService from "../services/predict.service";
import { AIServiceError } from "../types";

/** Send an upstream/network failure to the client with its real status and message. */
function sendError(res: Response, err: unknown): void {
  const error = err as AIServiceError;
  const status = error.status || 502;
  res.status(status).json({
    error: error.message || "AI service unavailable",
    upstreamStatus: error.upstream ? status : undefined,
  });
}

export const proxyPredict = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.forwardToAI(req, "/predict"));
  } catch (err) {
    sendError(res, err);
  }
};

export const proxyPredictCharacter = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.forwardToAI(req, "/predict-character"));
  } catch (err) {
    sendError(res, err);
  }
};

export const proxyProcessText = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.forwardJSON(req.body, "/process-text"));
  } catch (err) {
    sendError(res, err);
  }
};

export const proxySuggest = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.forwardJSON(req.body, "/suggest"));
  } catch (err) {
    sendError(res, err);
  }
};

export const proxyAutocomplete = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.forwardJSON(req.body, "/autocomplete"));
  } catch (err) {
    sendError(res, err);
  }
};

export const proxyLearn = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.forwardJSON(req.body, "/learn"));
  } catch (err) {
    sendError(res, err);
  }
};

export const proxyPersonalDict = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await predictService.fetchFromAI("/personal-dict"));
  } catch (err) {
    sendError(res, err);
  }
};
