import { Router } from "express";
import * as healthController from "../controllers/health.controller";

const router = Router();

router.get("/health", healthController.checkHealth);

export default router;
