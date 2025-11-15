// src/app/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import { authenticateUser, registerUser } from "../services/auth.service";
import { signToken } from "../utils/jwt";

/**
 * POST /api/auth/register
 *
 * Body:
 * {
 *   "username": "jay",
 *   "password": "secret123",
 *   "email": "optional@example.com",
 *   "phoneNumber": "+15555550123"
 * }
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      username,
      password,
      email,
      phoneNumber,
    }: {
      username?: string;
      password?: string;
      email?: string;
      phoneNumber?: string;
    } = req.body || {};

    const user = await registerUser({
      username: username ?? "",
      password: password ?? "",
      email,
      phoneNumber,
    });

    const token = signToken({
      sub: user.id,
      username: user.username,
    });

    res.status(201).json({
      id: user.id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      token,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 *
 * Body:
 * {
 *   "username": "jay",
 *   "password": "secret123"
 * }
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      username,
      password,
    }: {
      username?: string;
      password?: string;
    } = req.body || {};

    const user = await authenticateUser(username ?? "", password ?? "");

    const token = signToken({
      sub: user.id,
      username: user.username,
    });

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      token,
    });
  } catch (err) {
    next(err);
  }
};
