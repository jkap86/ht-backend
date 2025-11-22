// src/db/pool.ts
import { Pool } from "pg";
import { env } from "../config/env.config";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // You can add more options here (ssl, max connections, etc.) later
});
