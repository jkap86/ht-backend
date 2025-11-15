// src/db/pool.ts
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ DATABASE_URL is not set. Please set it in your environment."
  );
  process.exit(1);
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  // You can add more options here (ssl, max connections, etc.) later
});
