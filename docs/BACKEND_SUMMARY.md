# Backend Summary

## Scope

Implemented and verified the Supabase/Postgres backend only. No frontend/UI files were changed.

The backend is now applied and tested against the hosted Supabase project from `.env`; Docker/local Supabase is no longer required for backend verification.

## Tables

- Business tables: `contacts`, `products`, `sales`, `sale_items`, `purchases`, `purchase_items`, `payments`, `payment_allocations`, `stock_movements`
- Internal tables: `idempotency_keys`, `shop_settings`
- Removed per final decision: no `profiles`, no `audit_log`, no `created_by`, `updated_by`, or `actor_id` columns

## Database Logic

- Versioned optimistic locking triggers on editable records.
- Immutable stock ledger with cached `products.stock_on_hand`.
- Payment reversal model creates a linked opposite-direction payment and matching allocations; original payments are not edited or deleted.
- Sale cancellation rejects sales with net allocated payments; reverse payments first, then cancel.
- Purchase cancellation rejects if reversing stock would make current stock negative.
- Idempotency protection is implemented for all public write functions.

## Functions And Views

- Contact RPCs: `create_contact`, `update_contact`, `deactivate_contact`
- Product RPCs: `create_product`, `update_product`, `deactivate_product`, `correct_stock`
- Sale RPCs: `create_draft_sale`, `add_sale_item`, `update_sale_item`, `remove_sale_item`, `finalize_sale`, `cancel_sale`
- Purchase RPCs: `create_draft_purchase`, `add_purchase_item`, `update_purchase_item`, `remove_purchase_item`, `finalize_purchase`, `cancel_purchase`
- Payment RPCs: `record_payment`, `allocate_payment`, `reverse_payment`
- Settings RPC: `update_shop_settings`
- Derived data: `sale_balances`, `purchase_balances`, `contact_balances`, `contact_statement`, `daily_payment_totals`, `stock_reconciliation`, `reconcile_stock()`

## RLS And Auth

- RLS is enabled on every backend table.
- Policies route access through `app.is_owner()`, which checks the authenticated owner configured in `shop_settings`.
- Public signup is disabled in `supabase/config.toml`, but the hosted Auth settings endpoint currently reports `disable_signup=false`. The service-role Auth settings endpoint is read-only here (`PATCH`/`PUT` returned `405`), so disable public signup manually in the Supabase dashboard or via a Supabase Management API access token.
- The hosted owner account exists and `shop_settings.owner_user_id` / `owner_email` are bound by `npm run backend:create-owner`.
- REST verification passed: anon sees zero contacts, the owner can read and call write RPCs, and an authenticated non-owner receives `403` from guarded write RPCs.

## Tests

Run:

```bash
npm run backend:test
```

This runs `supabase/tests/backend.sql` directly against `DATABASE_URL` and rolls test data back.

Latest hosted run: passed.

Coverage includes invalid constraints, sale and purchase lifecycles, partial payments, advances, payment reversals, cancellation rules, optimistic locking, idempotency, stock reconciliation, contact statements, and daily cash/UPI totals.

## Verification Fixes

- Fixed `products_box_config_chk` so `has_box = true` cannot pass with null box fields.
- Added stable document-number tiebreakers for oldest-bill-first auto allocation because `now()` gives identical `created_at` values inside one transaction.
- Added explicit owner guards to `security definer` RPCs and made derived views `security_invoker`.
- Revoked default function execution from `public`/`anon`; authenticated non-owner RPC calls are rejected by `app.assert_owner()`.
- Updated remote scripts to read `.env` and avoid local Docker ports.
