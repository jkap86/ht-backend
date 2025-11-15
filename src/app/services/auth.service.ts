// src/app/services/auth.service.ts
import bcrypt from "bcrypt";
import { pool } from "../../db/pool";

export type AuthResult = {
  id: string;
  username: string;
  email: string | null;
  phoneNumber: string | null;
};

type UserRow = {
  id: string;
  username: string;
  email: string | null;
  phone_number: string | null;
  password_hash: string;
};

const SALT_ROUNDS = 10;

// Helper to normalize phone numbers (for now just trim; we can improve later)
function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  return trimmed === "" ? null : trimmed;
}

// Helper to throw HTTP-style errors
function httpError(statusCode: number, message: string): Error {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Registers a new user:
 * - Ensures username is unique
 * - Optionally stores email + phone_number
 * - Hashes password with bcrypt
 */
export const registerUser = async (params: {
  username: string;
  password: string;
  email?: string;
  phoneNumber?: string;
}): Promise<AuthResult> => {
  const username = params.username.trim();
  const password = params.password;
  const email = params.email?.trim() || null;
  const phoneNumber = normalizePhone(params.phoneNumber);

  if (!username || !password) {
    throw httpError(400, "Username and password are required");
  }

  // Check if username already exists
  const existing = await pool.query<UserRow>(
    `
      SELECT id, username
      FROM users
      WHERE username = $1
      LIMIT 1;
    `,
    [username]
  );

  if (existing.rowCount && existing.rows.length > 0) {
    throw httpError(409, "Username is already taken");
  }

  // Optional: check for duplicate phone number
  if (phoneNumber) {
    const existingPhone = await pool.query<UserRow>(
      `
        SELECT id
        FROM users
        WHERE phone_number = $1
        LIMIT 1;
      `,
      [phoneNumber]
    );

    if (existingPhone.rowCount && existingPhone.rows.length > 0) {
      throw httpError(409, "Phone number is already in use");
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await pool.query<UserRow>(
    `
      INSERT INTO users (username, email, phone_number, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, phone_number, password_hash;
    `,
    [username, email, phoneNumber, passwordHash]
  );

  const user = result.rows[0];

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phoneNumber: user.phone_number,
  };
};

/**
 * Authenticates a user by username + password.
 */
export const authenticateUser = async (
  username: string,
  password: string
): Promise<AuthResult> => {
  const trimmedUsername = username.trim();

  if (!trimmedUsername || !password) {
    throw httpError(400, "Username and password are required");
  }

  const result = await pool.query<UserRow>(
    `
      SELECT id, username, email, phone_number, password_hash
      FROM users
      WHERE username = $1
      LIMIT 1;
    `,
    [trimmedUsername]
  );

  if (result.rowCount === 0) {
    // Avoid revealing whether username exists
    throw httpError(401, "Invalid username or password");
  }

  const user = result.rows[0];

  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw httpError(401, "Invalid username or password");
  }

  // TODO: generate a real JWT/opaque token
  // For now we return core user info — token/whoami can be added later.
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phoneNumber: user.phone_number,
  };
};
