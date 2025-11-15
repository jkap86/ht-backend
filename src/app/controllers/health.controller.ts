import { Request, Response } from "express";
import { getServiceHealth } from "../services/health.service";

export const getHealthStatus = (req: Request, res: Response) => {
  const health = getServiceHealth();
  res.json(health);
};
