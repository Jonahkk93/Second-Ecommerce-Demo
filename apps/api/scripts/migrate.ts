import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString });
  try {
    for (const file of ["0001_initial.sql", "0002_firestore_replacement.sql", "0003_local_auth.sql", "0004_auth_tokens.sql"]) {
      const sql = await readFile(resolve(process.cwd(), "drizzle", file), "utf8");
      await pool.query(sql);
    }
    console.log("Database migration completed");
  } finally {
    await pool.end();
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
