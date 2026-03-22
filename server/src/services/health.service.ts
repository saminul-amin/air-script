import { HealthStatus } from "../types";

export const getHealthStatus = (): HealthStatus => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "air-drawing-server",
  };
};
