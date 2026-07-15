Build the Narayani Traders Dashboard / Overview page as a clean, read-only business summary.

The dashboard should not contain action buttons such as New Bill, Record Payment, or Restock. Those operations already belong to their dedicated pages.

The dashboard’s purpose is only to answer:

* How are sales performing?
* How much money has been collected?
* How much has been purchased and paid?
* What currently needs attention?
* What happened recently?

Keep the existing Narayani Traders visual direction:

* clean and minimal,
* black, white, and muted secondary surfaces,
* default app typography,
* restrained borders,
* no shadows unless extremely subtle,
* no gradients,
* no oversized KPI cards,
* no excessive icons,
* no colorful ERP-style dashboard,
* mobile responsive,
* centered inside the existing max-w-6xl protected layout.

Use installed shadcn/ui components wherever appropriate.

⸻

1. Install and use shadcn Charts

Use the official shadcn chart components rather than building custom SVG or raw Recharts wrappers.

First inspect whether the chart component is already installed.

If not, install it using the correct shadcn CLI command for the project’s current configuration, for example:

npx shadcn@latest add chart

Use the generated shadcn components such as:

ChartContainer
ChartTooltip
ChartTooltipContent
ChartLegend
ChartLegendContent
ChartConfig

Use Recharts primitives only through the shadcn chart structure.

Do not manually hardcode chart colors inside JSX. Use the project’s chart CSS variables and shadcn chart configuration.

Verify that charts work correctly in both light and dark themes if the app supports both.

⸻

2. Dashboard route

Use the protected root route:

/

or the existing protected dashboard route already used by the application.

Do not create a duplicate dashboard route.

The page should use authoritative Supabase views or backend RPCs. Do not repeat financial formulas independently in React.

Prefer one dashboard RPC that returns all required dashboard data in one consistent snapshot if such an RPC does not already exist.

Suggested backend operation:

get_dashboard_overview(
  start_date,
  end_date,
  timezone
)

It may return structured JSON or typed result sets for:

weekly_sales
sales_collection
purchase_payments
customers_due
suppliers_payable
low_stock_products
recent_sales
recent_purchases
recent_payments

Use the owner’s configured timezone consistently.

⸻

3. Page header

Use a simple header:

Overview
A clear view of sales, payments, stock, and recent activity.

Do not add buttons beside the heading.

Keep the header compact and aligned with the Products page styling.

⸻

4. Weekly sales chart

The first major section should be a full-width weekly sales chart.

Use the official shadcn chart component with a vertical bar chart.

Title:

Weekly sales

Description:

Finalized sales across the last 7 days.

Show:

* one bar for each of the last seven calendar days,
* localized short day/date labels,
* sales amount in INR,
* total sales for the seven-day period,
* percentage or amount comparison against the previous seven-day period.

Example chart labels:

Mon
Tue
Wed
Thu
Fri
Sat
Sun

Use the actual last seven days, not a fixed Monday-to-Sunday period, unless the existing reporting model already uses calendar weeks.

Chart data must include zero-value days so the timeline never skips a day.

Only finalized, non-cancelled sales count toward sales.

Use:

BarChart
Bar
XAxis
CartesianGrid
ChartTooltip
ChartTooltipContent

Recommended presentation:

* no visible y-axis unless it improves readability,
* subtle horizontal grid,
* rounded bar tops,
* compact INR tooltip,
* no legend for a single-series chart,
* no decorative background.

Above or below the chart, show:

₹48,250
Last 7 days
+12% from previous 7 days

Do not claim an increase when the comparison period is zero. Handle zero and no-data cases correctly.

⸻

5. Sales collection donut chart

Below weekly sales, create a two-column chart row on desktop and one column on mobile.

The left chart is:

Sales collection

This chart compares:

Collected
Pending

Definitions:

Total billed:
sum of finalized, non-cancelled sales in the selected reporting period
Collected:
completed incoming payments allocated to those sales
Pending:
total billed - collected

Do not count unrelated customer advances as collection for a bill unless they are allocated to that bill.

Use a shadcn donut or pie chart.

Use:

PieChart
Pie
Label
ChartContainer
ChartTooltip
ChartTooltipContent
ChartLegend
ChartLegendContent

The center label should show either:

84 bills

or:

₹48,250 billed

Choose the one that produces the clearest implementation, but also show the bill count as supporting text.

Below or beside the chart show:

Collected     ₹42,300
Pending        ₹5,950
Total bills        84

The chart should represent amounts, not bill counts.

Handle fully paid, fully pending, and zero-sales states safely.

⸻

6. Purchase payment donut chart

The right chart mirrors the sales collection card.

Title:

Purchase payments

Compare:

Paid
Outstanding

Definitions:

Total purchased:
sum of finalized, non-cancelled purchases in the reporting period
Paid:
completed outgoing payments allocated to those purchases
Outstanding:
total purchased - paid

Do not count unallocated supplier advances as payment against a purchase until allocated.

Center label:

18 purchases

or the total purchased value.

Supporting rows:

Paid             ₹31,200
Outstanding       ₹4,800
Purchases             18

The two donut chart cards should use the same visual structure, spacing, typography, dimensions, and responsive behavior.

⸻

7. Reporting period

For the first version:

* weekly sales chart: last 7 days,
* collection and purchase-payment charts: current month.

Clearly label the period in each section so users do not compare mismatched numbers unknowingly.

Example:

Last 7 days
This month

Do not add a complex global date-range picker yet.

A small period label is enough.

⸻

8. Needs attention

Create a section:

Needs attention
Important balances and stock items that may need review.

On desktop, show three equal columns:

Customers who owe
Suppliers to pay
Low-stock products

On mobile, stack them vertically.

Use restrained shadcn Card components or plain bordered sections consistent with the existing UI.

Avoid large colored cards.

Customers who owe

Show the top five customers with the highest positive customer balance.

Each row:

Customer name
₹2,450 due

Sort descending by amount due.

Only include active or historically valid customer contacts with a positive balance.

Footer link:

View all customers

Link to:

/people?tab=customers&filter=due

Adapt the URL to the actual route structure.

Suppliers to pay

Show the top five suppliers with the highest positive supplier balance.

Each row:

Supplier name
₹6,800 payable

Sort descending by amount payable.

Footer link:

View all suppliers

Low-stock products

Show up to five active products where:

stock_on_hand <= reorder_level

Sort:

1. out-of-stock products first,
2. then lowest stock relative to reorder level,
3. then product name.

Each row:

Product name
12 pieces left

For zero stock:

Out of stock

Footer link:

View all products

Link to the low-stock filter on /products.

Empty states

If a list has no entries, show calm positive text:

No customer dues
No supplier payments pending
Stock levels look good

Do not show empty blank cards.

⸻

9. Recent activity

Create one combined section:

Recent activity
The latest bills, purchases, and payments.

Use shadcn Tabs:

Bills
Purchases
Payments

Do not render three separate permanent tables.

Each tab should show the latest five or ten records.

Bills tab

Columns or compact row information:

Bill number
Customer
Date
Total
Payment state

Payment state should be derived:

Paid
Partial
Pending
Cancelled

Clicking a row should open or navigate to the existing bill detail experience.

Purchases tab

Show:

Purchase number
Supplier
Date
Total
Payment state

Payments tab

Show:

Payment number
Contact
Direction
Method
Date
Amount

Translate payment direction into readable language:

Received
Paid

Do not display raw enum values.

Use one responsive table on desktop.

On mobile, use compact stacked rows if the table becomes difficult to scan.

Do not duplicate detailed statement logic on the dashboard.

⸻

10. Dashboard data integrity

Every displayed number must use the backend’s authoritative definitions.

Do not calculate balances by independently joining raw tables in multiple React components.

Required rules:

Sales:
finalized and non-cancelled only
Purchases:
finalized and non-cancelled only
Collected:
completed, non-reversed incoming payments allocated to sales
Purchase paid:
completed, non-reversed outgoing payments allocated to purchases
Customer due:
opening balance + finalized sales - completed incoming payments
Supplier payable:
opening balance + finalized purchases - completed outgoing payments
Low stock:
active products only

Use the existing backend balance views if available.

If the necessary dashboard RPC or views do not exist, add them through a new migration without weakening existing RLS, owner guards, security-invoker views, transaction guarantees, or financial history.

⸻

11. Loading states

Use shadcn Skeleton components.

The dashboard should show:

* chart skeleton,
* two donut-card skeletons,
* three attention-list skeletons,
* recent-activity table skeleton.

Do not block the entire page with one global spinner.

Sections should retain their approximate final size while loading to avoid layout shift.

⸻

12. Error states

If dashboard loading fails:

* show a clear inline error,
* include a Retry button,
* use Sonner for a concise error notification,
* do not display raw Supabase, Postgres, RPC, or stack-trace errors.

Suggested message:

We couldn’t load the overview. Please try again.

If one subsection fails independently, keep the rest of the dashboard visible where practical.

⸻

13. Number formatting

Use shared formatting helpers.

Currency:

₹48,250
₹1.25 lakh only if the rest of the app already uses compact Indian notation

Prefer full INR formatting for balances and tooltips.

Counts:

84 bills
18 purchases
12 pieces left

Dates should use the existing en-IN locale formatting.

Do not use USD or Western-only number formatting.

⸻

14. Component structure

Use a maintainable structure similar to:

app/(app)/page.tsx
app/(app)/dashboard/actions.ts
components/dashboard/
  dashboard-overview.tsx
  weekly-sales-chart.tsx
  collection-donut-chart.tsx
  purchase-payment-donut-chart.tsx
  attention-section.tsx
  attention-list.tsx
  recent-activity.tsx
  dashboard-skeleton.tsx
  dashboard-error.tsx
lib/dashboard/
  types.ts
  formatters.ts
  chart-config.ts

Adapt this to existing repository conventions.

Do not over-abstract tiny components.

⸻

15. Chart accessibility

Ensure:

* chart cards have visible titles and descriptions,
* tooltip values are readable,
* chart information also appears as text outside the visual,
* users do not need color alone to distinguish collected and pending values,
* empty chart states show text rather than a broken circle,
* chart containers have appropriate minimum heights,
* charts resize correctly.

⸻

16. Responsive layout

Desktop:

Weekly sales chart — full width
Sales collection | Purchase payments
Customers due | Suppliers payable | Low stock
Recent activity — full width

Tablet:

* charts may remain two columns if space allows,
* attention cards can become two plus one or stacked.

Mobile:

* all sections stack,
* charts remain readable,
* legends do not overflow,
* attention rows maintain aligned values,
* recent activity switches to compact rows if necessary.

Do not create a separate mobile dashboard route.

⸻
