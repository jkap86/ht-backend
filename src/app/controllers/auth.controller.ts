// src/app/controllers/auth.controller.ts
import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../db/pool";
import { AuthRequest } from "../middleware/auth.middleware";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
// 7 days in seconds (prevents TS error with string type)
const JWT_EXPIRES = 60 * 60 * 24 * 7;

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
    const err: any = new Error("Username already in use");
    err.status = 400;
    throw err;
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
  const err: any = new Error("Invalid username or password");
  err.status = 401;
  throw err;
};

const generateToken = (user: UserRow): string => {
  return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
};

// ---------------- CONTROLLERS ---------------- //

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = req.body;

    const user = await createUser(username, password);
    const token = generateToken(user);

    res.status(201).json({ user: { id: user.id, username: user.username }, token });
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
    const { username, password } = req.body;

    const user = await validateUser(username, password);
    const token = generateToken(user);

    res.json({ user: { id: user.id, username: user.username }, token });
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
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });

    const user = await findUserByUsername(req.user.username);
    if (!user) return res.status(404).json({ error: "User not found" });

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
