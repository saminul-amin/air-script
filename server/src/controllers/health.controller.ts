import { Request, Response } from "express";
import * as healthService from "../services/health.service";

export const checkHealth = async (_req: Request, res: Response): Promise<void> => {
  const status = await healthService.getHealthStatus();
  res.json(status);
};
