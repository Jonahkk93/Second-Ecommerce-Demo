import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString, max: 1 });
try {
  for (const file of ["0001_initial.sql", "0002_firestore_replacement.sql", "0003_local_auth.sql", "0004_auth_tokens.sql"]) {
    await pool.query(await readFile(resolve("apps/api/drizzle", file), "utf8"));
  }
  console.log("Production database migrations completed");
} finally {
  await pool.end();
}
