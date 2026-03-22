import express from "express";
import cors from "cors";
import healthRoutes from "./routes/health.routes";
import predictRoutes from "./routes/predict.routes";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", healthRoutes);
app.use("/api", predictRoutes);

export default app;
