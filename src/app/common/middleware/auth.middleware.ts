// src/app/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    username: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or invalid Authorization header" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const payload = verifyToken(token);

    // Map the JWT payload to the expected format
    req.user = {
      userId: payload.sub,
      username: payload.username,
    };

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
