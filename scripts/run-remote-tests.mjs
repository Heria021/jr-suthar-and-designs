import { spawnSync } from "node:child_process";
import { loadEnv, requireEnv } from "./env.mjs";

loadEnv();
requireEnv(["DATABASE_URL"]);

const result = spawnSync("psql", [
  process.env.DATABASE_URL,
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  "supabase/tests/backend.sql",
], { stdio: "inherit" });

if (result.status !== 0) {
  throw new Error("Remote backend tests failed");
}

console.log("Remote backend tests passed.");
