// src/app/utils/jwt.ts
import * as jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const RAW_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.error("❌ JWT_SECRET is not set. Please add it to your .env file.");
  process.exit(1);
}

export interface JwtPayload {
  sub: string; // user id
  username: string;
}

export function signToken(
  payload: JwtPayload,
  options?: { expiresIn?: string }
): string {
  const signOptions: jwt.SignOptions = {
    // NOTE:
    // @types/jsonwebtoken wants `number | StringValue` from `ms`,
    // but env vars are always string. This cast is safe because
    // jsonwebtoken itself accepts strings like "7d", "1h", etc.
    expiresIn: (options?.expiresIn || RAW_EXPIRES_IN) as unknown as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(payload, JWT_SECRET as jwt.Secret, signOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(
    token,
    JWT_SECRET as jwt.Secret
  ) as jwt.JwtPayload & Partial<JwtPayload>;

  return {
    sub: (decoded.sub as string) ?? "",
    username: (decoded as any).username ?? "",
  };
}
