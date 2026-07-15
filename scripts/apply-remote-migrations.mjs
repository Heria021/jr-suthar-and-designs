import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, requireEnv } from "./env.mjs";

loadEnv();
requireEnv(["DATABASE_URL"]);

const migrationsDir = "supabase/migrations";
const migrations = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (migrations.length === 0) {
  throw new Error("No migration files found");
}

for (const migration of migrations) {
  console.log(`Applying migration ${migration}`);
  const result = spawnSync("psql", [
    process.env.DATABASE_URL,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    join(migrationsDir, migration),
  ], { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Migration failed: ${migration}`);
  }
}

console.log("Remote migrations applied.");
