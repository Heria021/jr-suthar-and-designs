# Codex Agent Task: Build & Test the Shop App Backend (Supabase)

## Context — read these two files first, in this exact order

1. `schema-doc-1-with-profiles.md` — the original architecture proposal (profiles table, roles, audit_log, multi-user tracking).
2. `schema-doc-2-single-owner.md` — a follow-up decision that **modifies and partially supersedes** document 1.

**Important:** Document 2 is the final source of truth wherever it conflicts with document 1. Specifically:

- Do **NOT** create `profiles`, `audit_log`, or any `created_by` / `updated_by` / `actor_id` columns.
- Authentication is a single predefined Supabase Auth owner account (email + password, magic link, forgot password). No public signup, no roles table.
- The final table list to build is exactly the "Revised final table list" in document 2:
  - `contacts`
  - `products`
  - `sales`
  - `sale_items`
  - `purchases`
  - `purchase_items`
  - `payments`
  - `payment_allocations`
  - `stock_movements`
  - `idempotency_keys`
  - Optional: `shop_settings` (single row) — include it, it's small and useful.
- Keep everything document 2 says to keep even with one user: `version` columns, `stock_movements` ledger, payment reversals (never edit/delete completed payments), cancellation instead of deletion, price/cost snapshots on line items, database transactions for every multi-step write, idempotency protection, and stock reconciliation (`products.stock_on_hand` must always equal `SUM(stock_movements.quantity_delta)`).
- Read both files fully before writing any SQL — do not start from partial memory of the schema.

## Scope of this task

**Backend only.** Do not build, scaffold, or reference any frontend/UI code in this task — that is a separate future task. Your job ends when the database, its functions, and all backend operations are built, migrated, seeded, and verified by tests.

## What to do

### 1. Environment setup

- Install the Supabase CLI.
- Initialize a new Supabase project in this repo (`supabase init`).
- Start the local Supabase stack (`supabase start`) and confirm Postgres, Auth, and the Studio are running.
- Create the single owner auth user via the CLI/Auth admin API (use a placeholder email/password stored in `.env`, e.g. `OWNER_EMAIL` / `OWNER_PASSWORD` — do not hardcode secrets in migration files).
- Confirm public signup is disabled in the Auth config.

### 2. Schema — migrations

Using `supabase migration new <name>` for each logical step, write SQL migrations that create:

- All 10 core tables (or 11 with `shop_settings`) exactly as specified in document 2, with every column, type, default, and constraint listed there (uuid PKs, `numeric(14,2)` for money, integer base units, `date` vs `timestamptz` per the foundation rules in document 1 — those foundation rules still apply, only the profiles/audit_log/created_by parts were removed).
- Enum-like check constraints for all the "allowed values" lists (`contact_type`, `entry_mode`, `status` fields, `movement_type`, `direction`, `payment_method`, etc.) — use `check` constraints or Postgres `enum` types, your choice, but be consistent.
- Foreign keys exactly as specified (`contacts`, `products`, `sales`, `purchases`, `sale_items`, `purchase_items`, `payments`, `payment_allocations`, `stock_movements`).
- The `payment_allocations` rule: exactly one of `sale_id` / `purchase_id` must be non-null (check constraint).
- A permanent seed row for `Walk-in Customer` (`contact_type = walk_in`, `opening_balance = 0`).
- Indexes needed for the search/filter/reporting operations described in document 2 (contact search by name/phone/type/balance, product search/filter by name/SKU/stock status, date-based lookups for sales/purchases/payments, `stock_movements` by product).
- A trigger (or shared function) that auto-updates `updated_at` and increments `version` on every `UPDATE`, and rejects the update (raise an error) if the client-supplied `version` doesn't match the current row — implement the optimistic-locking behavior described in document 2.
- Row Level Security enabled on every table, with a policy restricting all access to the single authenticated owner (`auth.uid()` matches the one owner user).

### 3. Business logic — database functions

Implement every workflow below as a Postgres function (SQL or PL/pgSQL, `security definer` where appropriate), each wrapped in a single transaction so it either fully succeeds or fully rolls back. Each function must accept an idempotency key and use `idempotency_keys` to detect and safely handle duplicate/retried calls (same key + same payload hash → return prior result; same key + different payload → reject).

- `create_contact`, `update_contact`, `deactivate_contact` (opening balance editable only pre-transaction).
- `create_product`, `update_product`, `deactivate_product`, `correct_stock` (writes a `stock_movements` row with the correct `movement_type`/`reason`, never edits `stock_on_hand` directly outside a movement).
- `create_draft_sale`, `add_sale_item`, `update_sale_item`, `remove_sale_item` (draft-only), `finalize_sale` (validate → lock product rows → check stock → calculate totals → snapshot line items → create stock-out movements → update cached stock → optionally create+allocate initial payment → mark finalized), `cancel_sale` (reason required, reverses stock via `sale_cancellation` movements, handles/rejects allocated payments per a defined rule you choose and document).
- `create_draft_purchase`, `add_purchase_item`, `update_purchase_item`, `remove_purchase_item` (draft-only), `finalize_purchase` (mirror of `finalize_sale`, stock-in movements, optional product cost update), `cancel_purchase` (must reject if reversal would drive current stock negative).
- `record_payment` (handles direction `in`/`out`, optional automatic oldest-bill-first allocation across `sale`/`purchase`, or leaves unallocated as advance), `allocate_payment` (manual allocation with the validation rules from document 2: amount > 0, allocations can't exceed payment amount or document balance, customer payments only settle that customer's sales, supplier payments only settle that supplier's purchases), `reverse_payment` (creates a linked reversal row, never edits/deletes the original, reverses allocations transactionally).
- Balance/derived-value functions or views for: customer balance, supplier balance, sale paid/due, purchase paid/due, contact statement (chronological running balance), daily cash/UPI closing totals — all computed from underlying tables per the "Final balance formulas" section of document 1, never stored as editable columns.
- A `reconcile_stock()` function/view that flags any product where `stock_on_hand` ≠ `SUM(stock_movements.quantity_delta)`.
- If you included `shop_settings`, a simple `update_shop_settings` function (single row, versioned).

### 4. Testing

Write and run automated tests (pgTAP, or a SQL/psql test script, or a small script using the Supabase client — your choice, but it must be repeatable via one command) that cover, at minimum:

- Every table's constraints reject invalid data (bad enum values, negative prices/stock, missing required FK, box fields required when `has_box = true`, etc.).
- Full happy-path lifecycle: create contact → create product with opening stock → create draft sale → add items (loose and box mode) → finalize → verify stock decremented correctly, `stock_movements` row created, line-item snapshots frozen, customer balance updated correctly.
- Same lifecycle for purchases (stock incremented, supplier balance updated, cost comparison logic if implemented).
- Partial payments: one payment allocated across multiple sales; verify paid/due amounts and statuses (`Paid` / `Partially paid` / `Pending`).
- Advance payment with no allocation, then later applied to a new bill.
- Payment reversal: verify original row untouched, reversal row created, allocations reversed, balances correct again.
- Sale cancellation: verify stock restored via `sale_cancellation` movement and the correct payment/allocation handling.
- Purchase cancellation rejected when it would make stock negative; accepted when safe.
- Version/optimistic-locking conflict: simulate two concurrent updates with stale `version`, confirm the second is rejected.
- Idempotency: call `finalize_sale` (or any protected function) twice with the same idempotency key and same payload → second call returns the first result without double-processing; same key with a different payload → rejected.
- `reconcile_stock()` reports zero mismatches after a batch of mixed operations (sales, purchases, corrections, cancellations).

### 5. Wrap-up

- Make sure all migrations apply cleanly from scratch (`supabase db reset`) and all tests pass after a fresh reset.
- Produce a short summary (in a markdown file, e.g. `BACKEND_SUMMARY.md`) listing: tables created, functions created, RLS policies, and test results/coverage — so this can be handed off as the starting point for the frontend task later.
- Do not start any frontend work. Stop once the backend is built, migrated, seeded, and fully tested.
