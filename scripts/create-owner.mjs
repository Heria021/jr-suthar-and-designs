import { spawnSync } from "node:child_process";
import { loadEnv, requireEnv } from "./env.mjs";

loadEnv();
requireEnv(["OWNER_EMAIL", "OWNER_PASSWORD", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"]);

const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const apiUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

const lookup = await fetch(`${apiUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
  headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
});
if (!lookup.ok) throw new Error(`Owner lookup failed: ${lookup.status} ${await lookup.text()}`);
const lookupJson = await lookup.json();
let user = lookupJson.users?.find((candidate) => candidate.email === email);

if (!user) {
  const created = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!created.ok) throw new Error(`Owner creation failed: ${created.status} ${await created.text()}`);
  user = await created.json();
}

const updateResult = spawnSync("psql", [
  dbUrl,
  "-v",
  "ON_ERROR_STOP=1",
  "-c",
  `update public.shop_settings set owner_user_id = '${user.id}', owner_email = '${email.replaceAll("'", "''")}', version = version where id;`,
], { stdio: "inherit" });

if (updateResult.status !== 0) {
  throw new Error("Failed to update owner settings row");
}

console.log(`Owner ready: ${email}`);
