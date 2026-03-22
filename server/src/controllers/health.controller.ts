import { Request, Response } from "express";
import * as healthService from "../services/health.service";

export const checkHealth = (_req: Request, res: Response): void => {
  const status = healthService.getHealthStatus();
  res.json(status);
};
