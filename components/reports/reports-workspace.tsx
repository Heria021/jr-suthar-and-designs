"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  money,
  numberText,
  preciseMoney,
} from "@/lib/dashboard/formatters"
import type {
  BalanceReportRow,
  PaymentReportRow,
  ProfitProductRow,
  PurchaseReportRow,
  ReportMetric,
  ReportsData,
  SalesReportRow,
  StockReportRow,
} from "@/lib/reports/types"

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" })

function formatMetric(metric: ReportMetric) {
  if (metric.kind === "money") return money(metric.value)
  if (metric.kind === "percent") return `${metric.value.toFixed(1)}%`
  return numberText(metric.value)
}

function paymentDirection(direction: "in" | "out") {
  return direction === "in" ? "Received" : "Paid"
}

function paymentStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const s = status.toLowerCase()
  if (s === "paid" || s === "collected" || s === "cleared") return "default"
  if (s === "partial") return "secondary"
  if (s === "unpaid" || s === "pending" || s === "overdue") return "destructive"
  return "outline"
}

function stockVariant(
  status: StockReportRow["stock_status"]
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Out of stock") return "destructive"
  if (status === "Low stock") return "secondary"
  return "outline"
}

export function ReportsWorkspace({ data }: { data: ReportsData }) {
  return (
    <div className="flex w-full flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Sales, purchases, payments, stock, balances, and profit for{" "}
            {data.periodLabel}.
          </p>
        </div>
        <span className="w-fit rounded-md border px-2.5 py-1 text-xs text-muted-foreground">
          {data.periodLabel}
        </span>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
          {(
            [
              { value: "sales", label: "Sales" },
              { value: "purchases", label: "Purchases" },
              { value: "payments", label: "Payments" },
              { value: "stock", label: "Stock" },
              { value: "balances", label: "Balances" },
              { value: "profit", label: "Profit" },
            ] as const
          ).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-8 rounded-md border bg-secondary/50 px-3 text-xs font-medium text-muted-foreground shadow-none transition-colors hover:bg-secondary hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sales" className="mt-5">
          <ReportSection metrics={data.sales.metrics}>
            <SalesTable rows={data.sales.rows} />
          </ReportSection>
        </TabsContent>

        <TabsContent value="purchases" className="mt-5">
          <ReportSection metrics={data.purchases.metrics}>
            <PurchasesTable rows={data.purchases.rows} />
          </ReportSection>
        </TabsContent>

        <TabsContent value="payments" className="mt-5">
          <ReportSection metrics={data.payments.metrics}>
            <PaymentsTable rows={data.payments.rows} />
          </ReportSection>
        </TabsContent>

        <TabsContent value="stock" className="mt-5">
          <ReportSection metrics={data.stock.metrics}>
            <StockTable rows={data.stock.rows} />
          </ReportSection>
        </TabsContent>

        <TabsContent value="balances" className="mt-5">
          <ReportSection metrics={data.balances.metrics}>
            <BalancesTable rows={data.balances.rows} />
          </ReportSection>
        </TabsContent>

        <TabsContent value="profit" className="mt-5">
          <ReportSection metrics={data.profit.metrics}>
            <ProfitTable rows={data.profit.rows} />
          </ReportSection>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ReportSection({
  metrics,
  children,
}: {
  metrics: ReportMetric[]
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1 rounded-xl bg-secondary/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </p>
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {formatMetric(metric)}
            </p>
          </div>
        ))}
      </div>
      {children}
    </div>
  )
}

function ReportTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-secondary/50">
      <div className="overflow-x-auto">
        <Table className="min-w-[800px]">{children}</Table>
      </div>
    </div>
  )
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return (
    <TableRow>
      <TableCell
        colSpan={columns}
        className="h-24 text-center text-sm text-muted-foreground"
      >
        {text}
      </TableCell>
    </TableRow>
  )
}

function SalesTable({ rows }: { rows: SalesReportRow[] }) {
  return (
    <ReportTable>
      <TableHeader>
        <TableRow className="hover:bg-secondary/60">
          <TableHead className="h-10 min-w-[140px] px-4 text-xs font-medium text-muted-foreground">Bill</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Customer</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Date</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Total</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Collected</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Pending</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3">
                <Link href={`/sales/${row.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {row.sale_number}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.customer_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{dateFormatter.format(new Date(row.sale_date))}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.total_amount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{money(row.paid_amount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{money(row.due_amount)}</TableCell>
              <TableCell>
                <Badge variant={paymentStatusVariant(row.payment_status)} className="rounded-md font-medium shadow-none">
                  {row.payment_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow columns={7} text="No finalized sales in this period." />
        )}
      </TableBody>
    </ReportTable>
  )
}

function PurchasesTable({ rows }: { rows: PurchaseReportRow[] }) {
  return (
    <ReportTable>
      <TableHeader>
        <TableRow className="hover:bg-secondary/60">
          <TableHead className="h-10 min-w-[140px] px-4 text-xs font-medium text-muted-foreground">Purchase</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Supplier</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Date</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Total</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Paid</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Outstanding</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3">
                <Link href={`/purchases/${row.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {row.purchase_number}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.supplier_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{dateFormatter.format(new Date(row.purchase_date))}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.total_amount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{money(row.paid_amount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{money(row.due_amount)}</TableCell>
              <TableCell>
                <Badge variant={paymentStatusVariant(row.payment_status)} className="rounded-md font-medium shadow-none">
                  {row.payment_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow columns={7} text="No finalized purchases in this period." />
        )}
      </TableBody>
    </ReportTable>
  )
}

function PaymentsTable({ rows }: { rows: PaymentReportRow[] }) {
  return (
    <ReportTable>
      <TableHeader>
        <TableRow className="hover:bg-secondary/60">
          <TableHead className="h-10 min-w-[140px] px-4 text-xs font-medium text-muted-foreground">Payment</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Contact</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Direction</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Method</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Date</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Amount</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3">
                <Link href={`/payments/${row.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {row.payment_number}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.contact_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{paymentDirection(row.direction)}</TableCell>
              <TableCell className="text-sm capitalize text-muted-foreground">{row.payment_method}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{dateFormatter.format(new Date(row.payment_date))}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.amount)}</TableCell>
              <TableCell>
                <Badge variant={paymentStatusVariant(row.status)} className="rounded-md font-medium capitalize shadow-none">
                  {row.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow columns={7} text="No payments in this period." />
        )}
      </TableBody>
    </ReportTable>
  )
}

function StockTable({ rows }: { rows: StockReportRow[] }) {
  return (
    <ReportTable>
      <TableHeader>
        <TableRow className="hover:bg-secondary/60">
          <TableHead className="h-10 min-w-[200px] px-4 text-xs font-medium text-muted-foreground">Product</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">SKU</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Stock</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Reorder</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Cost</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Value</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3">
                <Link href={`/products/${row.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.sku ?? "—"}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">
                {numberText(row.stock_on_hand)}{" "}
                <span className="font-normal text-muted-foreground">{row.unit_name}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{numberText(row.reorder_level)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{preciseMoney(row.loose_cost_price)}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.stock_value)}</TableCell>
              <TableCell>
                <Badge variant={stockVariant(row.stock_status)} className="rounded-md font-medium shadow-none">
                  {row.stock_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow columns={7} text="No active products." />
        )}
      </TableBody>
    </ReportTable>
  )
}

function BalancesTable({ rows }: { rows: BalanceReportRow[] }) {
  return (
    <ReportTable>
      <TableHeader>
        <TableRow className="hover:bg-secondary/60">
          <TableHead className="h-10 min-w-[200px] px-4 text-xs font-medium text-muted-foreground">Contact</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Phone</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Type</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Customer due</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Supplier payable</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3">
                <Link href={`/contact/${row.id}`} className="text-sm font-medium text-foreground hover:underline">
                  {row.name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.phone ?? "—"}</TableCell>
              <TableCell className="text-sm capitalize text-muted-foreground">{row.contact_type.replaceAll("_", " ")}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.customer_balance)}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.supplier_balance)}</TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow columns={5} text="No open contact balances." />
        )}
      </TableBody>
    </ReportTable>
  )
}

function ProfitTable({ rows }: { rows: ProfitProductRow[] }) {
  return (
    <ReportTable>
      <TableHeader>
        <TableRow className="hover:bg-secondary/60">
          <TableHead className="h-10 min-w-[200px] px-4 text-xs font-medium text-muted-foreground">Product</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Units sold</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Revenue</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Cost</TableHead>
          <TableHead className="h-10 text-xs font-medium text-muted-foreground">Gross profit</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length ? (
          rows.map((row) => (
            <TableRow key={row.product_id} className="transition-colors hover:bg-secondary/40">
              <TableCell className="px-4 py-3 text-sm font-medium text-foreground">{row.product_name}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{numberText(row.quantity)}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.revenue)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{money(row.cost)}</TableCell>
              <TableCell className="text-sm font-medium text-foreground">{money(row.gross_profit)}</TableCell>
            </TableRow>
          ))
        ) : (
          <EmptyRow columns={5} text="No finalized sale items in this period." />
        )}
      </TableBody>
    </ReportTable>
  )
}
