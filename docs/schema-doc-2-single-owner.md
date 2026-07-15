# Shop App — Database Architecture (Single Owner, Simplified)

Yes. With one predefined owner account, we can simplify authentication and remove user-account tracking without weakening the financial or inventory architecture.

## Authentication setup

Use one Supabase Auth account with the owner's fixed email.

The login page can offer:

- Email + password
- Send magic link
- Forgot password
- Sign out

A magic link and password reset are different:

- **Magic link:** logs the owner in without entering a password.
- **Forgot password:** sends a recovery link that lets the owner set a new password.

Public signup should be completely disabled. Only the predefined email can access the app.

---

## What changes in the database

### Remove profiles

We do not need a separate `profiles` table because:

- there is only one account,
- there are no roles,
- there is no employee management,
- the Supabase `auth.users` record already identifies the account.

Remove these columns from business tables:

```
created_by
updated_by
actor_id
```

Keep:

```
created_at
updated_at
```

These still tell us when something happened.

---

### Remove audit_log

Yes, we can remove the general-purpose `audit_log`.

It mainly answered:

```
Which user changed this?
```

With one owner, that answer is always the same.

However, removing `audit_log` does not mean removing transactional history. We must still keep:

- bills rather than deleting them,
- payment reversals rather than editing money history,
- stock movements for every stock change,
- cancelled states and cancellation reasons,
- historical price and cost snapshots,
- timestamps,
- idempotency protection.

These tables provide the important business audit trail without maintaining a separate technical audit log.

---

### Keep version

Keep a version integer on editable records.

Even with one user, the app may be open in:

- two browser tabs,
- a phone and laptop,
- an old tab that has stale data.

The version prevents an old screen from silently overwriting newer changes.

Example:

```
Current product version = 5
Old tab tries to save version = 4
Database rejects it and asks the app to refresh
```

---

### Keep idempotency_keys

This remains important.

Single-user does not prevent:

- double tapping Save,
- mobile network retries,
- browser retries,
- duplicate API requests.

Idempotency prevents duplicate bills, payments, purchases, and stock deductions.

---

## Revised final table list

**Visible business data**

1. contacts
2. products
3. sales
4. sale_items
5. purchases
6. purchase_items
7. payments
8. payment_allocations
9. stock_movements

**Internal system data**

10. idempotency_keys

Optionally, we can add one single-row `shop_settings` table for the shop name, invoice prefix, phone number, address, and receipt preferences.

---

## Operations and features for every table

### 1. contacts

This stores customers, suppliers, the walk-in customer, and businesses that are both customers and suppliers.

**Main operations**

**Create contact**

Fields shown:

```
Name
Phone
Type: Customer / Supplier / Both
Opening balance
Optional note
```

The app should explain opening balance in plain language:

For customers:

```
They owe us
They have advance with us
No previous balance
```

For suppliers:

```
We owe them
We have advance with them
No previous balance
```

The UI converts that choice into a signed balance.

**Edit contact**

Allow editing:

```
Name
Phone
Notes
Type
```

Opening balance should only be editable before the contact has any transactions. After that, corrections should happen through a payment or opening-balance correction workflow.

**Deactivate contact**

Do not delete contacts with history.

Deactivation means:

- hidden from new bills or purchases,
- still visible in old history,
- can be reactivated later.

**Search contacts**

Search by:

```
Name
Phone
Customer/supplier type
Outstanding balance
```

**View contact details**

Show:

```
Current balance
Pending bills or purchases
Payments
Sales or purchase history
Total business to date
Last transaction date
```

**Record payment**

From a contact page:

```
Customer paid us
We paid supplier
Customer gave advance
We gave supplier advance
```

**View statement**

A chronological statement:

```
Opening balance
Bill or purchase
Payment
Advance
Cancellation/reversal
Running balance
```

**Why these features matter**

The contact page becomes the single place to answer:

```
How much does this person owe?
Why is that the balance?
When did they last pay?
Which bills are still pending?
```

---

### 2. products

This stores product configuration and cached current stock.

**Main operations**

**Add product**

Fields:

```
Product name
Unit name
Loose sale price
Loose cost price
Has box?
Units per box
Box sale price
Box cost price
Opening stock
Low-stock level
```

**Edit product**

Allow editing:

```
Name
Prices
Current cost
Box configuration
Reorder level
```

Do not directly edit `stock_on_hand` from the normal product form.

Stock corrections must use a separate Correct Stock action.

**Deactivate product**

A discontinued product:

- disappears from new bills and restocks,
- remains visible in old bills,
- keeps all historical profit and stock data.

**Search and filter**

Search by name or SKU.

Filters:

```
All
Low stock
Out of stock
Inactive
```

**View product details**

Show:

```
Current stock
Loose and box prices
Current cost
Stock value
Units sold
Sales revenue
Estimated profit
Purchase history
Stock movement history
Last sold
Last restocked
```

**Correct stock**

The owner enters the actual counted stock.

Example:

```
System stock: 96
Actual stock: 92
Reason: damaged items
```

The database creates a movement:

```
quantity_delta = -4
```

It never silently replaces stock without explanation.

**Quick price change**

For frequent price changes, provide a small action:

```
Update sale price
Update cost price
```

Historical bills remain unchanged because line items store snapshots.

**Why these features matter**

The product table controls daily item selection, pricing, stock safety, reorder alerts, and profitability while preserving historical accuracy.

---

### 3. sales

One row represents one bill.

**Main operations**

**Create draft sale**

When the New Bill screen opens, the app may create a temporary draft locally or in the database.

Fields:

```
Customer
Sale date
Discount
Notes
```

Walk-in Customer is selected by default.

**Add and remove bill items**

Items live in `sale_items`, but the sale screen coordinates the entire bill.

**Finalize bill**

This is the important operation.

The database must atomically:

1. validate the sale is still a draft,
2. validate every item,
3. lock affected products,
4. confirm enough stock exists,
5. calculate subtotal and total,
6. finalize the sale,
7. create stock-out movements,
8. reduce cached product stock,
9. create the initial payment if money was received,
10. allocate that payment to the bill.

One tap for your brother; one database transaction underneath.

**View bill**

Show:

```
Bill number
Date
Customer
Items
Subtotal
Discount
Total
Paid
Balance due
Payment history
Status
```

**Share or print bill**

Options:

```
Download PDF
Print
Share through WhatsApp
```

**Record later payment**

The bill page can open Record Payment with the outstanding amount already filled.

**Cancel bill**

Never delete a finalized bill.

Cancellation requires:

```
Reason
Confirmation
```

The database must:

- mark it cancelled,
- create opposite stock movements,
- restore stock,
- handle or reject existing allocated payments according to a controlled workflow.

**Edit bill**

Recommended rule:

- Draft bill: freely editable
- Finalized unpaid bill: do not directly edit; cancel and recreate
- Finalized paid bill: cancel only through controlled reversal

This is safer than modifying historical financial records in place.

**Derived sale features**

Do not store these as editable columns:

```
paid amount
balance due
payment status
```

Compute:

```
paid amount = allocated completed payments
balance due = total - paid amount
```

Display status:

```
Paid
Partially paid
Pending
Cancelled
```

**Why these features matter**

The sale is the central daily workflow. Its finalization transaction guarantees that the bill, customer balance, payment, and inventory never end up in conflicting states.

---

### 4. sale_items

This stores each product line inside a sale.

**Main operations**

**Add item**

The owner selects:

```
Product
Loose or box
Quantity
Price
```

The app fills the standard price automatically but allows an intentional price override.

**Update quantity**

Changing quantity recalculates:

```
base quantity
line total
cost snapshot
available stock check
```

**Change mode**

Example:

```
Loose → Box
```

The conversion uses the product's current `box_units`.

**Override selling price**

Allow changing the charged price on that bill.

This is useful for:

- negotiated prices,
- older customers,
- small discounts.

The original product price remains unchanged.

**Remove item**

Allowed only while the sale is a draft.

**Snapshot data on finalization**

Freeze:

```
Product name
Entry mode
Entered quantity
Units per entry
Base quantity
Charged price
Line total
Cost total
```

**Calculate profit**

```
line profit = line_total - cost_total_snapshot
```

**Why these features matter**

This table separates the natural bill entry:

```
2 boxes
```

from inventory math:

```
48 pieces
```

It also ensures historical bills do not change when product names, prices, costs, or box sizes change later.

---

### 5. purchases

One row represents one supplier restocking bill.

**Main operations**

**Create purchase draft**

Fields:

```
Supplier
Purchase date
Supplier invoice number
Discount
Transport/additional cost
Notes
```

**Add restock items**

Products are added through `purchase_items`.

**Finalize purchase**

The database must atomically:

1. validate the purchase,
2. calculate the total,
3. lock product rows,
4. create stock-in movements,
5. increase cached stock,
6. finalize the purchase,
7. create and allocate any payment made,
8. optionally update the product's current cost.

**View purchase**

Show:

```
Purchase number
Supplier bill number
Supplier
Products received
Purchase total
Paid
Balance due
Payment history
```

**Record supplier payment**

The outstanding amount is suggested automatically.

**Cancel purchase**

Requires a reason.

The database must confirm that reversing it will not make current stock negative.

Example:

```
Purchased 100 units
Already sold 90
Only 10 remain
```

A full purchase cancellation cannot safely remove all 100 units. The app should reject it or require a controlled correction workflow.

**Share or attach supplier bill**

Later, an optional image or PDF attachment may be stored, but it is not necessary for the first version.

**Why these features matter**

Purchases increase stock and supplier debt together. Finalizing them transactionally prevents inventory from increasing without a matching supplier purchase.

---

### 6. purchase_items

This stores individual products received during restocking.

**Main operations**

**Add product**

Choose:

```
Product
Loose or box
Quantity
Cost per piece or box
```

**Calculate base quantity**

Example:

```
20 boxes × 12 units = 240 base units
```

**Calculate line total**

```
entered quantity × cost per entry
```

**Compare previous cost**

Show a small warning:

```
Previous box cost: ₹250
Current box cost: ₹265
Increase: ₹15
```

**Update current product cost**

When finalizing, the app may ask:

```
Update product cost to latest purchase cost?
```

The recommended default is yes.

**Remove or edit item**

Allowed only in draft purchases.

**Store purchase snapshot**

Preserve:

```
Product name
Mode
Box units
Quantity
Cost
Line total
```

**Why these features matter**

Purchase items are the trustworthy source for what entered inventory, at what cost, from which supplier, and on what date.

---

### 7. payments

Every actual money movement is stored here.

**Main operations**

**Record customer payment**

Fields:

```
Customer
Amount
Date
Method
Optional reference
Optional note
```

The app can automatically allocate it to oldest pending bills.

**Record supplier payment**

Same simple form:

```
Supplier
Amount
Date
Method
```

**Record advance**

A payment can exist without being fully linked to a sale or purchase.

Examples:

```
Customer deposits ₹500 in advance
Shop pays supplier ₹2,000 in advance
```

**View payment**

Show:

```
Payment number
Contact
Amount
Direction
Method
Date
Bills/purchases settled
Unallocated advance
```

**Reverse payment**

Completed payments should not be edited or deleted.

A wrong payment is reversed by creating a linked reversal.

Example:

```
Original incoming payment: +₹500
Reversal: -₹500 effect
```

The original history remains visible.

**Method reporting**

The payment table supports:

```
Cash received today
UPI received today
Bank payments
Cash paid to suppliers
```

**Daily closing**

Show:

```
Opening cash
Cash received
Cash paid out
Expected closing cash
```

Opening cash may initially be entered manually on the dashboard if needed.

**Why these features matter**

Sales and purchases record obligations. Payments record real money movement. Keeping them separate is what makes partial payments, advances, supplier credit, and daily cash reporting accurate.

---

### 8. payment_allocations

This connects payments to specific sales or purchases.

It is mainly an internal table.

**Main operations**

**Automatically allocate payment**

For customers:

```
Oldest pending bill first
```

For suppliers:

```
Oldest pending purchase first
```

**Manually allocate payment**

The owner can optionally choose specific bills.

Example:

```
Allocate ₹300 to INV-0501
Allocate ₹700 to INV-0504
```

**Allocate an existing advance**

When a new bill is made for a customer with advance credit:

```
Available advance: ₹500
Apply to this bill?
```

**Unallocate during reversal**

When a payment is reversed, its allocations are also reversed transactionally.

**Validate allocations**

Database guarantees:

```
Allocated amount > 0
Total allocations cannot exceed payment amount
Allocation cannot exceed document balance
Customer payment can only settle that customer's sales
Supplier payment can only settle that supplier's purchases
```

**Why these features matter**

Without allocations, the app could know a customer paid money but could not accurately identify which bills remain pending.

It also supports one payment covering several bills.

---

### 9. stock_movements

This is the immutable stock ledger.

**Main operations**

Most movements are not manually created. They are generated by database functions.

**Opening stock movement**

Created when a new product begins with existing inventory.

```
movement_type = opening
quantity_delta = +100
```

**Sale movement**

Generated when a bill is finalized.

```
movement_type = sale
quantity_delta = -24
```

**Purchase movement**

Generated when restocking is finalized.

```
movement_type = purchase
quantity_delta = +960
```

**Stock correction**

Created from Correct Stock.

Movement reasons can include:

```
Damaged
Expired
Missing
Free sample
Personal use
Counting correction
Other
```

**Sale cancellation movement**

Restores previously sold inventory.

```
movement_type = sale_cancellation
quantity_delta = +24
```

**Purchase cancellation movement**

Removes stock introduced by the cancelled purchase, only when safe.

**View stock history**

The product page can show:

```
13 Jul: Sold through INV-0501      -24
10 Jul: Manual correction           -3
01 Jul: Restocked through PUR-002  +960
```

**Reconcile stock**

The system regularly checks:

```
products.stock_on_hand
=
SUM(stock_movements.quantity_delta)
```

Any mismatch should be treated as a critical data-integrity error.

**Why these features matter**

The product row tells us current stock. The movement ledger explains every unit that entered or left the shop.

This is essential even for one user because physical inventory naturally has losses, corrections, damaged goods, and counting mistakes.

---

### 10. idempotency_keys

This is completely internal.

**Main operations**

**Reserve operation key**

Before executing actions such as:

```
Finalize sale
Finalize purchase
Record payment
Cancel sale
Reverse payment
Correct stock
```

the backend reserves a unique request key.

**Detect duplicate request**

If the same request reaches the server twice:

```
First request: executes normally
Second request: receives first request's result
```

**Detect changed duplicate**

If the same key is reused with different data, reject it.

Example:

```
Same key, first amount ₹500
Same key, second amount ₹700
```

This must not be accepted.

**Expire old keys**

Old successful keys may be cleaned after a safe retention period, such as 30–90 days.

Financial document numbers remain permanently unique independently of this cleanup.

**Why these features matter**

This protects the system from accidental duplicate writes caused by double-clicking, network retries, or frontend bugs.

---

## Optional shop_settings

I recommend one hidden single-row table:

```
shop_settings
-------------
id
shop_name
owner_name
phone
address
invoice_prefix
purchase_prefix
currency
receipt_footer
updated_at
version
```

**Operations**

- Edit shop name and contact details
- Choose invoice prefix
- Configure receipt footer
- Set default currency to INR
- Configure whether prices include tax
- Configure default payment method
- Upload an optional shop logo later

**Why it matters**

It prevents business identity and receipt configuration from being hardcoded throughout the application.

There should still be no large Settings area. This can be a small protected page opened only when needed.

---

## Final screens supported by these tables

**Login**

```
Email
Password
Login
Send magic link
Forgot password
```

No signup.

**Home**

```
New Bill
Record Payment
Restock
Today's sales
Cash and UPI received
Customers who owe
Suppliers to pay
Low stock
```

**New Bill**

Powered by:

```
contacts
products
sales
sale_items
payments
payment_allocations
stock_movements
idempotency_keys
```

**Products**

Powered by:

```
products
sale_items
purchase_items
stock_movements
```

**People**

Powered by:

```
contacts
sales
purchases
payments
payment_allocations
```

**Restock**

Powered by:

```
contacts
products
purchases
purchase_items
payments
payment_allocations
stock_movements
idempotency_keys
```

---

## What we removed safely

```
profiles
roles
permissions
created_by
updated_by
audit_log
signup
employee management
```

## What must remain despite having one user

```
stock_movements
payment history
payment allocations
cancellation instead of deletion
payment reversals
cost and price snapshots
record versioning
idempotency protection
database transactions
database constraints
automatic reconciliation
backups
```

That gives us the right balance: one-owner simplicity without sacrificing long-term correctness.
