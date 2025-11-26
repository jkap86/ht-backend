// src/app/utils/jwt.ts
import * as jwt from "jsonwebtoken";
import { env } from "../../../config/env.config";

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
    expiresIn: (options?.expiresIn || env.JWT_EXPIRES_IN) as unknown as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(payload, env.JWT_SECRET as jwt.Secret, signOptions);
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(
    token,
    env.JWT_SECRET as jwt.Secret
  ) as jwt.JwtPayload & Partial<JwtPayload>;

  return {
    sub: (decoded.sub as string) ?? "",
    username: (decoded as any).username ?? "",
  };
}
