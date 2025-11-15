// src/db/migrate.ts
import fs from "fs";
import path from "path";
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

const pool = new Pool({
  connectionString: DATABASE_URL,
});

const MIGRATIONS_TABLE = "migrations";

async function ensureMigrationsTable() {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await pool.query(createTableSql);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const res = await pool.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE};`
  );

  return new Set(res.rows.map((row) => row.name));
}

function getMigrationsDir(): string {
  // At runtime, this will resolve correctly from dist/db/migrate.js
  // back up to the project root, then into /migrations.
  return path.join(__dirname, "..", "..", "migrations");
}

function loadMigrationFiles(): string[] {
  const migrationsDir = getMigrationsDir();

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort(); // Lexicographical sort: 001_, 002_, 003_, ...

  return files;
}

async function runMigrationFile(fileName: string) {
  const migrationsDir = getMigrationsDir();
  const filePath = path.join(migrationsDir, fileName);

  const sql = fs.readFileSync(filePath, "utf8");

  // eslint-disable-next-line no-console
  console.log(`➡️  Running migration: ${fileName}`);

  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING;`,
      [fileName]
    );
    await pool.query("COMMIT");

    // eslint-disable-next-line no-console
    console.log(`✅ Migration completed: ${fileName}`);
  } catch (err) {
    await pool.query("ROLLBACK");
    // eslint-disable-next-line no-console
    console.error(`❌ Migration failed: ${fileName}`);
    // eslint-disable-next-line no-console
    console.error(err);
    throw err;
  }
}

async function runMigrations() {
  try {
    // eslint-disable-next-line no-console
    console.log("🔗 Connecting to database...");
    await ensureMigrationsTable();

    const applied = await getAppliedMigrations();
    const files = loadMigrationFiles();

    // eslint-disable-next-line no-console
    console.log(`📦 Found ${files.length} migration(s).`);
    // eslint-disable-next-line no-console
    console.log(
      `📚 Already applied: ${
        applied.size > 0 ? Array.from(applied).join(", ") : "none"
      }`
    );

    for (const file of files) {
      if (applied.has(file)) {
        // eslint-disable-next-line no-console
        console.log(`↩️  Skipping already applied migration: ${file}`);
        continue;
      }

      await runMigrationFile(file);
    }

    // eslint-disable-next-line no-console
    console.log("🎉 All migrations completed.");
  } finally {
    await pool.end();
  }
}

// Run as a script
runMigrations().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Migration process failed:", err);
  process.exit(1);
});
