import { Router } from "express";
import * as predictController from "../controllers/predict.controller";

const router = Router();

router.post("/predict", predictController.proxyPredict);
router.post("/predict-character", predictController.proxyPredictCharacter);
router.post("/process-text", predictController.proxyProcessText);
router.post("/suggest", predictController.proxySuggest);
router.post("/autocomplete", predictController.proxyAutocomplete);
router.post("/learn", predictController.proxyLearn);
router.get("/personal-dict", predictController.proxyPersonalDict);

export default router;
