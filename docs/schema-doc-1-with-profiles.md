# Shop App — Database Architecture (With Profiles & Roles)

We should build it like a small shop app on the surface and a financial/inventory ledger underneath.

The final model should have:

- 9 core business tables
- 3 internal hardening tables
- Only four simple workflows visible to your brother: bill, payment, restock, stock correction

The extra internal tables do not create extra screens. They prevent duplicate bills, unexplained stock changes, and silent data edits.

---

## Foundation rules for every table

Before the individual tables, these rules apply everywhere:

- Primary keys: uuid
- Money: numeric(14,2), never floating point
- Quantity: integer base units wherever possible
- Dates: date for business dates, timestamptz for system timestamps
- Every important row records:
  - created_at
  - updated_at
  - created_by
- Financial history is never physically deleted
- Bills and purchases are finalized through database functions
- Payment status, balances, and stock are calculated from underlying records
- Every write happens in a database transaction
- Important tables use a version column to prevent two devices overwriting each other

---

## Final table structure

### 1. profiles

This represents the people allowed to operate the app.

```
profiles
--------
id                    uuid primary key
full_name             text not null
phone                  text
is_active              boolean not null default true
created_at             timestamptz not null
updated_at             timestamptz not null
```

Authentication remains in Supabase Auth. `profiles.id` references the authenticated user ID.

Initially:

```
Hariom
Brother
```

Both may have the same permissions. We do not need a complex roles system.

**Why this structure matters**

Even with only two users, every bill, payment, purchase, stock correction, and cancellation should record who performed it.

Without profiles, you may later see that stock changed by 48 pieces but have no way to know whether it was:

- entered by your brother,
- corrected by you,
- caused by a bill,
- or caused by a software bug.

This table gives accountability without adding any complexity to the app.

---

### 2. contacts

Instead of separate customers and suppliers, I recommend one contacts table.

```
contacts
--------
id                       uuid primary key
name                     text not null
phone                    text
contact_type             text not null
opening_balance          numeric(14,2) not null default 0
opening_balance_date     date
notes                    text
is_active                boolean not null default true
created_at               timestamptz not null
updated_at               timestamptz not null
created_by               uuid references profiles(id)
version                  integer not null default 1
```

Allowed `contact_type` values:

```
customer
supplier
both
walk_in
```

Opening-balance meaning:

For customers:

```
Positive = customer owes the shop
Negative = customer has an advance
```

For suppliers:

```
Positive = shop owes the supplier
Negative = advance paid to supplier
```

A permanent contact will exist:

```
Walk-in Customer
contact_type = walk_in
opening_balance = 0
```

**Why this structure matters**

One person or business can sometimes be both a customer and a supplier. Separate tables could create duplicate identities:

```
Ramesh Traders in customers
Ramesh Traders in suppliers
```

Then phone numbers, balances, and history could disagree.

A unified contacts table provides:

- one identity,
- one phone number,
- one complete history,
- less duplicated code,
- easier search,
- easier balance calculation.

The UI can still show separate Customers and Suppliers tabs. Your brother never needs to know they share a table.

`is_active` is necessary because contacts with financial history must not be deleted. When someone is no longer used, they are simply hidden from new entries.

---

### 3. products

This stores the current product configuration and fast stock balance.

```
products
--------
id                       uuid primary key
name                     text not null
sku                      text
unit_name                text not null default 'piece'
loose_sale_price         numeric(14,2) not null
loose_cost_price         numeric(14,2) not null
has_box                  boolean not null default false
box_units                integer
box_sale_price           numeric(14,2)
box_cost_price           numeric(14,2)
stock_on_hand            integer not null default 0
reorder_level            integer not null default 0
is_active                boolean not null default true
created_at               timestamptz not null
updated_at               timestamptz not null
created_by               uuid references profiles(id)
version                  integer not null default 1
```

Database constraints:

```
loose_sale_price >= 0
loose_cost_price >= 0
stock_on_hand >= 0
reorder_level >= 0
```

When `has_box = true`:

```
box_units > 1
box_sale_price is required
box_cost_price is required
```

**Why this structure matters**

Stock must have exactly one storage unit.

For example:

```
1 Parle-G box = 24 pieces
```

The database stores:

```
stock_on_hand = 340 pieces
```

It never stores:

```
14 boxes and 4 pieces
```

That prevents box and piece stock from drifting apart.

`stock_on_hand` is a cached current balance for fast screens and safe concurrency checks. However, every change will also be written to `stock_movements`, which remains the audit trail.

This gives both:

- fast dashboard performance,
- complete historical traceability.

`is_active` is important because products appearing on old bills cannot be deleted. A discontinued product is hidden from new bills while its history remains intact.

---

### 4. sales

One row represents one bill.

```
sales
-----
id                       uuid primary key
sale_number              text not null unique
customer_id              uuid not null references contacts(id)
sale_date                date not null
status                   text not null default 'draft'
subtotal                 numeric(14,2) not null default 0
discount_amount          numeric(14,2) not null default 0
total_amount             numeric(14,2) not null default 0
notes                    text
finalized_at             timestamptz
cancelled_at             timestamptz
cancellation_reason      text
created_at               timestamptz not null
updated_at               timestamptz not null
created_by               uuid references profiles(id)
version                  integer not null default 1
```

Allowed statuses:

```
draft
finalized
cancelled
```

We should not store:

```
paid_amount
balance_due
payment_status
```

Those values are computed from `payment_allocations`.

**Why this structure matters**

A bill has a lifecycle.

A user may begin entering products, make corrections, and then save it. Stock should not decrease while the bill is still incomplete.

Therefore:

- draft means editable and does not affect stock
- finalized means confirmed and financially valid
- cancelled means reversed, not deleted

When finalized, the database transaction will:

1. validate every item,
2. lock the affected products,
3. confirm sufficient stock,
4. calculate totals,
5. create stock-out movements,
6. update cached stock,
7. mark the bill finalized.

Either all steps succeed or none succeed.

A cancelled bill remains visible because deleting a bill would destroy the financial trail.

---

### 5. sale_items

This contains the products inside each bill.

```
sale_items
----------
id                       uuid primary key
sale_id                  uuid not null references sales(id)
product_id               uuid not null references products(id)
product_name_snapshot    text not null
entry_mode               text not null
entered_quantity         integer not null
base_units_per_entry     integer not null
base_quantity            integer not null
price_per_entry          numeric(14,2) not null
line_total               numeric(14,2) not null
cost_total_snapshot      numeric(14,2) not null
created_at               timestamptz not null
created_by               uuid references profiles(id)
```

Example for one box:

```
entry_mode = box
entered_quantity = 1
base_units_per_entry = 24
base_quantity = 24
price_per_entry = ₹260
line_total = ₹260
cost_total_snapshot = ₹200
```

Example for ten loose pieces:

```
entry_mode = loose
entered_quantity = 10
base_units_per_entry = 1
base_quantity = 10
price_per_entry = ₹12
line_total = ₹120
cost_total_snapshot = ₹90
```

Allowed entry modes:

```
loose
box
```

**Why this structure matters**

We must preserve both:

- what your brother entered,
- what the stock system deducted.

For a box sale, the user understands:

```
1 box
```

The stock system understands:

```
24 pieces
```

Keeping both values allows the bill to display naturally while inventory remains mathematically consistent.

The product name and cost are stored as snapshots because product details may change later.

Suppose Parle-G cost changes next month from ₹200 to ₹215 per box. Last month's bill must still show the original cost and original profit.

Profit becomes simple and safe:

```
line profit = line_total - cost_total_snapshot
```

We avoid dangerous formulas that mix per-box prices and per-piece quantities.

---

### 6. purchases

One row represents one supplier restocking bill.

```
purchases
---------
id                       uuid primary key
purchase_number          text not null unique
supplier_id              uuid not null references contacts(id)
supplier_invoice_number  text
purchase_date            date not null
status                   text not null default 'draft'
subtotal                 numeric(14,2) not null default 0
discount_amount          numeric(14,2) not null default 0
additional_cost          numeric(14,2) not null default 0
total_amount             numeric(14,2) not null default 0
notes                    text
finalized_at             timestamptz
cancelled_at             timestamptz
cancellation_reason      text
created_at               timestamptz not null
updated_at               timestamptz not null
created_by               uuid references profiles(id)
version                  integer not null default 1
```

Status values:

```
draft
finalized
cancelled
```

**Why this structure matters**

A restocking transaction affects two systems at once:

- inventory increases,
- supplier liability increases.

Those changes must happen atomically.

Finalizing a purchase will:

1. validate every purchase item,
2. calculate the total,
3. create stock-in movements,
4. increase product stock,
5. finalize the supplier purchase.

The supplier invoice number is kept separately because the supplier's paper bill number is different from the internal application purchase number.

`additional_cost` allows transport or loading charges without creating unnecessary complexity.

---

### 7. purchase_items

This stores products received during restocking.

```
purchase_items
--------------
id                       uuid primary key
purchase_id              uuid not null references purchases(id)
product_id               uuid not null references products(id)
product_name_snapshot    text not null
entry_mode               text not null
entered_quantity         integer not null
base_units_per_entry     integer not null
base_quantity            integer not null
cost_per_entry           numeric(14,2) not null
line_total               numeric(14,2) not null
created_at               timestamptz not null
created_by               uuid references profiles(id)
```

Example:

```
40 boxes of Parle-G
24 pieces per box
₹200 per box
```

Stored as:

```
entered_quantity = 40
base_units_per_entry = 24
base_quantity = 960
cost_per_entry = ₹200
line_total = ₹8,000
```

**Why this structure matters**

A purchase header only tells us:

```
₹9,600 was purchased from this supplier
```

It does not tell us which products entered stock.

`purchase_items` creates the exact bridge between:

- supplier purchase,
- product stock,
- latest product cost,
- supplier balance,
- historical purchase-price trends.

Without this table, the app could track supplier spending but could not guarantee product-level stock accuracy.

This table also allows us to show:

```
The previous box cost ₹200
The current box costs ₹215
Cost increased by 7.5%
```

---

### 8. payments

Every real money movement gets one row.

```
payments
--------
id                       uuid primary key
payment_number           text not null unique
contact_id               uuid not null references contacts(id)
direction                text not null
amount                   numeric(14,2) not null
payment_method           text not null
payment_date             date not null
reference_number         text
notes                    text
status                   text not null default 'completed'
reversed_payment_id      uuid references payments(id)
reversal_reason          text
created_at               timestamptz not null
created_by               uuid references profiles(id)
```

Directions:

```
in
out
```

Methods:

```
cash
upi
bank
card
other
```

Statuses:

```
completed
reversed
```

Examples:

```
Customer paid ₹300 cash       → direction = in
Supplier received ₹9,600      → direction = out
Customer paid ₹500 advance    → direction = in, no invoice allocation yet
```

**Why this structure matters**

A payment is different from a bill.

A bill answers:

```
How much was sold?
```

A payment answers:

```
How much money actually moved?
```

Mixing these two is a major source of accounting errors.

Payments are never edited or deleted after completion. If entered incorrectly, the app creates a reversal entry. That preserves an auditable money trail.

This allows accurate calculations for:

- customer balances,
- supplier balances,
- cash received today,
- UPI received today,
- advances,
- partial payments,
- payment history.

---

### 9. payment_allocations

This internal business table connects payments to specific bills or purchases.

```
payment_allocations
-------------------
id                       uuid primary key
payment_id               uuid not null references payments(id)
sale_id                  uuid references sales(id)
purchase_id              uuid references purchases(id)
allocated_amount         numeric(14,2) not null
created_at               timestamptz not null
created_by               uuid references profiles(id)
```

Database rule:

```
Exactly one of sale_id or purchase_id must be present.
```

Examples:

A ₹1,000 customer payment may be allocated as:

```
₹300 → INV-0501
₹500 → INV-0504
₹200 → customer advance
```

The remaining ₹200 remains unallocated in the payment record.

**Why this structure matters**

A single payment may settle more than one bill.

If we placed only one `invoice_id` inside payments, then one payment could belong to only one invoice. That would fail in common situations such as:

```
Ramesh pays ₹2,000 against his three pending bills
```

`payment_allocations` lets us accurately support:

- partial bill payments,
- one payment covering many bills,
- customer advances,
- supplier advances,
- automatic oldest-bill-first allocation,
- manual allocation later.

Your brother will not see this complexity. He can simply enter:

```
Ramesh paid ₹2,000
```

The backend can automatically allocate it to the oldest pending bills.

---

## Inventory ledger

### 10. stock_movements

Every stock increase or decrease gets an immutable ledger row.

```
stock_movements
---------------
id                       uuid primary key
product_id               uuid not null references products(id)
movement_type            text not null
quantity_delta           integer not null
sale_item_id             uuid references sale_items(id)
purchase_item_id         uuid references purchase_items(id)
reason                   text
stock_before             integer not null
stock_after              integer not null
occurred_at              timestamptz not null
created_by               uuid references profiles(id)
```

Movement types:

```
opening
sale
purchase
adjustment
sale_cancellation
purchase_cancellation
```

Examples:

```
Purchase received          +960
Sale of one box             -24
Damaged products             -3
Wrong count correction      +10
Cancelled sale               +24
```

**Why this structure matters**

`products.stock_on_hand` tells us current stock, but it does not explain how the stock reached that number.

The movement table answers:

```
Why did Parle-G stock change from 340 to 316?
```

It can show:

```
24 pieces deducted by INV-0501
```

Every movement records both the previous and resulting stock. This makes debugging and reconciliation much easier.

The ledger also allows the application to rebuild stock independently:

```
SUM(stock_movements.quantity_delta)
```

That value must always equal:

```
products.stock_on_hand
```

If they ever differ, the reconciliation system flags it.

---

## Internal production-hardening tables

These tables have no normal user-facing screens.

### 11. audit_log

This records important data actions.

```
audit_log
---------
id                       uuid primary key
actor_id                 uuid references profiles(id)
action                   text not null
entity_type              text not null
entity_id                uuid
old_data                 jsonb
new_data                 jsonb
request_id               uuid
created_at               timestamptz not null
```

Example actions:

```
sale.created
sale.finalized
sale.cancelled
payment.recorded
payment.reversed
product.updated
stock.adjusted
purchase.finalized
```

**Why this structure matters**

`stock_movements` explains inventory changes, and payments explain money movements. But we also need to know who changed product prices, phone numbers, notes, or reorder levels.

The audit log gives a forensic history:

```
Hari changed Parle-G box price from ₹250 to ₹260
13 July 2026, 4:42 PM
```

This is particularly valuable when two people operate the system.

---

### 12. idempotency_keys

This prevents accidental duplicate submissions.

```
idempotency_keys
----------------
id                       uuid primary key
idempotency_key          text not null unique
operation_type           text not null
actor_id                 uuid references profiles(id)
request_hash             text not null
result_entity_id         uuid
status                   text not null
created_at               timestamptz not null
expires_at               timestamptz not null
```

**Why this structure matters**

On a weak connection, your brother may press Save Bill twice, or the phone may retry the request automatically.

Without idempotency protection, that could create:

- two identical bills,
- stock deducted twice,
- customer charged twice.

With this table, repeated requests with the same key return the original result instead of executing again.

This is the same class of protection used in serious payment and commerce systems.

---

## Final balance formulas

**Customer balance**

```
opening balance
+ finalized sales
- completed incoming payments
```

Interpretation:

```
Positive = customer owes the shop
Negative = customer has an advance
Zero     = settled
```

**Supplier balance**

```
opening balance
+ finalized purchases
- completed outgoing payments
```

Interpretation:

```
Positive = shop owes supplier
Negative = advance exists with supplier
Zero     = settled
```

**Sale paid amount**

```
SUM(payment_allocations.allocated_amount for that sale)
```

**Sale due**

```
sale.total_amount - allocated payments
```

**Current stock**

Fast displayed value:

```
products.stock_on_hand
```

Audited source value:

```
SUM(stock_movements.quantity_delta)
```

Both must always match.

---

## Final table count

**Core operational tables**

1. profiles
2. contacts
3. products
4. sales
5. sale_items
6. purchases
7. purchase_items
8. payments
9. payment_allocations
10. stock_movements

**Internal hardening tables**

11. audit_log
12. idempotency_keys

This is not excessive for the user. Your brother still interacts with only:

- New Bill
- Record Payment
- Restock
- Products
- Customers/Suppliers

The additional structure exists entirely to guarantee that the app remains reliable after years of bills, corrections, price changes, partial payments, device retries, and multiple users.
