// src/app/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  AuthenticationError,
  ConflictError,
  NotFoundError,
} from "../utils/errors";
import { AuthValidator } from "../validators/auth.validator";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}

// Access token expires in 15 minutes
const JWT_EXPIRES = 60 * 15;
// Refresh token expires in 30 days
const REFRESH_TOKEN_EXPIRES_DAYS = 30;

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
}

const findUserByUsername = async (username: string): Promise<UserRow | null> => {
  const result = await pool.query<UserRow>(
    "SELECT * FROM users WHERE username = $1",
    [username]
  );
  return result.rows[0] ?? null;
};

const createUser = async (
  username: string,
  password: string
): Promise<UserRow> => {
  const exists = await findUserByUsername(username);
  if (exists) {
    throw new ConflictError("Username already in use");
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, password_hash`,
    [username, hash]
  );

  return result.rows[0];
};

const validateUser = async (
  username: string,
  password: string
): Promise<UserRow> => {
  const user = await findUserByUsername(username);

  if (!user) {
    return throwErrorAuth();
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return throwErrorAuth();
  }

  return user;
};

const throwErrorAuth = (): never => {
  throw new AuthenticationError("Invalid username or password");
};

const generateAccessToken = (user: UserRow): string => {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
};

const generateRefreshToken = (): string => {
  return crypto.randomBytes(64).toString("hex");
};

const saveRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await pool.query(
    `UPDATE users
     SET refresh_token = $1, refresh_token_expires_at = $2
     WHERE id = $3`,
    [refreshToken, expiresAt, userId]
  );
};

const findUserByRefreshToken = async (refreshToken: string): Promise<UserRow | null> => {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users
     WHERE refresh_token = $1
     AND refresh_token_expires_at > NOW()`,
    [refreshToken]
  );
  return result.rows[0] ?? null;
};

// ---------------- CONTROLLERS ---------------- //

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = AuthValidator.validateRegistration(
      req.body.username,
      req.body.password
    );

    const user = await createUser(username, password);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await saveRefreshToken(user.id, refreshToken);

    res.status(201).json({
      user: { id: user.id, username: user.username },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = AuthValidator.validateLogin(
      req.body.username,
      req.body.password
    );

    const user = await validateUser(username, password);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await saveRefreshToken(user.id, refreshToken);

    res.json({
      user: { id: user.id, username: user.username },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AuthenticationError("Unauthorized");
    }

    const user = await findUserByUsername(req.user.username);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = AuthValidator.validateRefreshToken(req.body.refreshToken);

    const user = await findUserByRefreshToken(refreshToken);

    if (!user) {
      throw new AuthenticationError("Invalid or expired refresh token");
    }

    // Generate new access token and refresh token
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();

    await saveRefreshToken(user.id, newRefreshToken);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
};
