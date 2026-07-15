"use client"

import Link from "next/link"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label as RechartsLabel,
  Pie,
  PieChart,
  XAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  purchasePaymentChartConfig,
  salesCollectionChartConfig,
  weeklySalesChartConfig,
} from "@/lib/dashboard/chart-config"
import type { ChartConfig } from "@/components/ui/chart"
import {
  money,
  numberText,
  preciseMoney,
} from "@/lib/dashboard/formatters"
import type {
  DashboardOverviewData,
  DonutSummary,
} from "@/lib/dashboard/types"

export function DashboardOverview({ data }: { data: DashboardOverviewData }) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        <div className="flex-[5] min-w-0 rounded-2xl bg-secondary/40 p-5">
          <WeeklySalesSection data={data} />
        </div>
        <div className="flex-[2] min-w-0 rounded-2xl bg-secondary/40 p-5">
          <CollectionDonut
            title="Sales collection"
            description={`Collections for ${data.currentMonthLabel}.`}
            period="This month"
            config={salesCollectionChartConfig}
            summary={data.salesCollection}
            primaryKey="collected"
            secondaryKey="pending"
            primaryLabel="Collected"
            secondaryLabel="Pending"
            countLabel="Total bills"
            centerLabel={`${numberText(data.salesCollection.count)} bills`}
            emptyLabel="No finalized sales this month."
          />
        </div>
        <div className="flex-[2] min-w-0 rounded-2xl bg-secondary/40 p-5">
          <CollectionDonut
            title="Purchase payments"
            description={`Supplier payments for ${data.currentMonthLabel}.`}
            period="This month"
            config={purchasePaymentChartConfig}
            summary={data.purchasePayments}
            primaryKey="paid"
            secondaryKey="outstanding"
            primaryLabel="Paid"
            secondaryLabel="Outstanding"
            countLabel="Purchases"
            centerLabel={data.purchasePayments.count === 1 ? "1 restock" : `${numberText(data.purchasePayments.count)} restocks`}
            emptyLabel="No finalized purchases this month."
          />
        </div>
      </div>

      <AttentionSection data={data} />
    </div>
  )
}

/** Shared header used by every card so title/badge sit on an identical baseline. */
function SectionHeader({
  title,
  description,
  badge,
}: {
  title: string
  description?: string
  badge: string
}) {
  return (
    <div className="flex flex-col gap-1.5 pb-3 border-b border-border/40">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-foreground leading-none">
          {title}
        </h2>
        <span className="shrink-0 rounded-md border px-2 py-0.5 text-xs leading-none text-muted-foreground bg-secondary/30">
          {badge}
        </span>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground leading-none">
          {description}
        </p>
      )}
    </div>
  )
}

function WeeklySalesSection({ data }: { data: DashboardOverviewData }) {
  const comparison = data.weeklySales.comparison
  const comparisonText =
    comparison.previous > 0
      ? `${comparison.changePercent !== null && comparison.changePercent >= 0 ? "+" : ""}${(comparison.changePercent ?? 0).toFixed(1)}% from previous 7 days`
      : comparison.current > 0
        ? `${money(comparison.current)} with no previous-period sales`
        : "No sales in either 7-day period"

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-3 border-b border-border/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground leading-none">
              Weekly sales
            </h2>
            <span className="rounded-md border px-2 py-0.5 text-xs leading-none text-muted-foreground bg-secondary/30">
              {data.lastSevenDaysLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Finalized sales across the last 7 days.
          </p>
        </div>
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          <p className="text-2xl font-semibold tabular-nums text-foreground leading-none">
            {money(comparison.current)}
          </p>
          <p className="text-xs text-muted-foreground">{comparisonText}</p>
        </div>
      </div>

      <ChartContainer
        config={weeklySalesChartConfig}
        className="h-[280px] w-full aspect-auto"
      >
        <BarChart accessibilityLayer data={data.weeklySales.points}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name) => (
                  <div className="flex min-w-32 items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      {weeklySalesChartConfig[name as keyof typeof weeklySalesChartConfig]?.label ??
                        name}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {preciseMoney(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="sales"
            fill="var(--color-sales)"
            radius={[5, 5, 0, 0]}
            barSize={24}
          />
        </BarChart>
      </ChartContainer>
    </section>
  )
}

function CollectionDonut({
  title,
  description,
  period,
  config,
  summary,
  primaryKey,
  secondaryKey,
  primaryLabel,
  secondaryLabel,
  countLabel,
  centerLabel,
  emptyLabel,
}: {
  title: string
  description: string
  period: string
  config: ChartConfig
  summary: DonutSummary
  primaryKey: string
  secondaryKey: string
  primaryLabel: string
  secondaryLabel: string
  countLabel: string
  centerLabel: string
  emptyLabel: string
}) {
  const chartData = [
    {
      name: primaryKey,
      label: primaryLabel,
      value: summary.primary,
      fill: `var(--color-${primaryKey})`,
    },
    {
      name: secondaryKey,
      label: secondaryLabel,
      value: summary.secondary,
      fill: `var(--color-${secondaryKey})`,
    },
  ].filter((entry) => entry.value > 0)
  const hasData = chartData.length > 0

  return (
    <section className="flex h-full flex-col gap-3">
      <SectionHeader title={title} description={description} badge={period} />

      {hasData ? (
        <ChartContainer
          config={config}
          className="mx-auto h-[160px] w-full max-w-[240px] aspect-square"
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => (
                    <div className="flex min-w-36 items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {config[name as keyof typeof config]?.label ?? name}
                      </span>
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {preciseMoney(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={46}
              outerRadius={64}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
              <RechartsLabel
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                    return null
                  }
                  const cx = viewBox.cx ?? 0
                  const cy = viewBox.cy ?? 0
                  return (
                    <text x={cx} y={cy} textAnchor="middle">
                      {/* Total amount — prominent, on top */}
                      <tspan
                        x={cx}
                        y={cy - 12}
                        className="fill-foreground text-sm font-semibold tabular-nums"
                      >
                        {money(summary.total)}
                      </tspan>
                      {/* Count label — small, below */}
                      <tspan
                        x={cx}
                        y={cy + 4}
                        className="fill-muted-foreground text-xs tabular-nums"
                      >
                        {centerLabel}
                      </tspan>
                    </text>
                  )
                }}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              verticalAlign="bottom"
            />
          </PieChart>
        </ChartContainer>
      ) : (
        <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      )}

      <div className="mt-auto divide-y divide-border/40">
        <MetricRow label={primaryLabel} value={money(summary.primary)} />
        <MetricRow label={secondaryLabel} value={money(summary.secondary)} />
        <MetricRow label={countLabel} value={numberText(summary.count)} />
      </div>
    </section>
  )
}

function AttentionSection({ data }: { data: DashboardOverviewData }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <AttentionList
        title="Customers who owe"
        emptyText="No outstanding customer dues"
        footerLabel="View all customers"
        footerHref="/contact"
        items={data.attention.customersDue.map((customer) => ({
          id: customer.id,
          href: `/contact/${customer.id}`,
          label: customer.name,
          value: `${money(customer.amount)} due`,
          badgeVariant: "destructive",
        }))}
      />
      <AttentionList
        title="Suppliers to pay"
        emptyText="No pending supplier payments"
        footerLabel="View all suppliers"
        footerHref="/contact"
        items={data.attention.suppliersPayable.map((supplier) => ({
          id: supplier.id,
          href: `/contact/${supplier.id}`,
          label: supplier.name,
          value: `${money(supplier.amount)} payable`,
          badgeVariant: "muted",
        }))}
      />
      <AttentionList
        title="Low stock products"
        emptyText="All stock levels look good"
        footerLabel="View all products"
        footerHref="/products"
        items={data.attention.lowStockProducts.map((product) => ({
          id: product.id,
          href: `/products/${product.id}`,
          label: product.name,
          value:
            product.stock_on_hand === 0
              ? "Out of stock"
              : `${numberText(product.stock_on_hand)} left`,
          badgeVariant: product.stock_on_hand === 0 ? "destructive" : "warning",
        }))}
      />
    </div>
  )
}

function AttentionList({
  title,
  items,
  emptyText,
  footerLabel,
  footerHref,
}: {
  title: string
  items: {
    id: string
    href: string
    label: string
    value: string
    badgeVariant: "destructive" | "warning" | "muted"
  }[]
  emptyText: string
  footerLabel: string
  footerHref: string
}) {
  return (
    <section className="flex h-full flex-col rounded-2xl bg-secondary/40 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-none">
        {title}
      </h3>
      <div className="flex-1 divide-y divide-border/40 mt-3">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center justify-between gap-4 py-1.5 transition-colors group"
          >
            <span className="truncate text-xs text-muted-foreground group-hover:text-foreground group-hover:underline">
              {item.label}
            </span>
            <span
              className={cn(
                "shrink-0 text-xs font-medium tabular-nums select-none",
                item.badgeVariant === "destructive" && "text-destructive",
                item.badgeVariant === "warning" && "text-amber-600 dark:text-amber-500",
                item.badgeVariant === "muted" && "text-muted-foreground"
              )}
            >
              {item.value}
            </span>
          </Link>
        ))}
        {!items.length ? (
          <p className="py-4 text-xs text-muted-foreground">{emptyText}</p>
        ) : null}
      </div>
      <Link
        href={footerHref}
        className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline pt-3 mt-auto w-fit"
      >
        {footerLabel}
      </Link>
    </section>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium tabular-nums text-foreground">{value}</span>
    </div>
  )
}