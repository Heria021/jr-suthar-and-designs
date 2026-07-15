# Codex Agent Task: Finish Backend Verification Against Remote Supabase (No Docker)

## Context

The backend was already built in a previous task: migrations, RPC functions, RLS, tests, and an owner-creation script all exist in this repo (`supabase/migrations/`, `supabase/tests/backend.sql`, `scripts/create-owner.mjs`, `BACKEND_SUMMARY.md`). That work is not being redone.

The only thing blocking completion was that local verification requires Docker (`supabase start` / `supabase db reset`), and Docker is not available on this machine.

**We are switching from a local Supabase instance to a hosted (remote) Supabase project.** No Docker is needed for any of this — migrations, seeding, and tests will all run directly against the remote Postgres database over its connection string.

## Credentials

`.env` in the repo root already contains:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
OWNER_EMAIL
OWNER_PASSWORD
```

Read these from `.env` at runtime. Do not print their values to logs, do not hardcode them anywhere in source, migrations, or scripts, and do not commit `.env`. If any script currently assumes a local Supabase URL/port (e.g. `http://localhost:54321` or a local DB port), update it to read from these env vars instead.

## What to do

### 1. Apply the existing migrations to the remote database

Do not write new migrations unless something below reveals an actual bug in the existing schema/functions — the schema itself is considered final. Apply what already exists in `supabase/migrations/` to the remote database. Use whichever of these works cleanly in this environment:

- `supabase db push --db-url "$DATABASE_URL"` (does not require `supabase link` or Docker), or
- Direct `psql "$DATABASE_URL" -f <migration file>` for each migration file in order, if the CLI approach has issues.

Confirm the migration applies cleanly to a fresh database with no manual fixes. If the remote database already has partial/previous schema state in it from an earlier attempt, decide whether to drop and recreate the public schema first so this is a true clean-slate run — check before destructively dropping anything, but a fresh Supabase project should be empty already.

### 2. Create the owner auth user

Run the existing `scripts/create-owner.mjs` (or equivalent `npm run backend:create-owner`) against the remote project using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`. Confirm the user is created and that `app.is_owner()` / the RLS policies correctly recognize this account.

Confirm public signup is disabled on the remote project's Auth settings (this was set locally in `supabase/config.toml` — verify it actually applies to the remote hosted project too, since config.toml settings don't always sync to a hosted project automatically; if they don't, set it via the Supabase Management API or note clearly that it needs to be set manually in the dashboard).

### 3. Run the backend test suite against the remote database

Update `npm run backend:test` (or whatever runs `supabase/tests/backend.sql`) to execute against `$DATABASE_URL` directly via `psql`, rather than assuming a local Docker Postgres instance. Run it and get a fully passing result — this was never verified in the previous task, so treat this as the first real run, not a re-run.

If tests fail, fix the underlying migration/function/test (whichever is actually wrong) and re-run until everything passes. Do not weaken assertions to make tests pass.

### 4. Full verification checklist

Confirm all of the following explicitly, not just "tests pass":

- All 11 tables exist with correct columns, constraints, and foreign keys as specified in `BACKEND_SUMMARY.md`.
- RLS is enabled on every table and only the owner account can read/write.
- `reconcile_stock()` returns zero mismatches after running a mixed batch of operations (sale finalize, purchase finalize, stock correction, sale cancellation, purchase cancellation) — not just after one simple flow.
- Idempotency: calling a protected RPC (e.g. `finalize_sale`) twice with the same idempotency key and same payload returns the original result without double-processing; the same key with a different payload is rejected.
- Optimistic locking: an update with a stale `version` value is rejected.
- Purchase cancellation is rejected when it would drive stock negative, and succeeds when safe.
- Payment reversal creates a linked opposite entry and never edits/deletes the original payment.
- Sale/purchase balances, contact statements, and daily cash/UPI totals are all computed correctly from underlying tables (not stored/editable columns).

### 5. Update the summary

Update `BACKEND_SUMMARY.md` to reflect:

- The backend now runs against a hosted Supabase project, not local Docker.
- Actual test results from this run (pass/fail, not "blocked").
- Any fixes made to migrations/functions/tests during this verification pass, with a short note on what was wrong and what changed.
- Confirmation that the owner account exists and RLS/auth behave as expected on the remote project.

## Scope reminder

Backend only. No frontend/UI work in this task.
