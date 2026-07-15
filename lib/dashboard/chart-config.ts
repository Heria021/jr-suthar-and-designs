import type { ChartConfig } from "@/components/ui/chart"

export const weeklySalesChartConfig = {
  sales: {
    label: "Sales",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

export const salesCollectionChartConfig = {
  collected: {
    label: "Collected",
    color: "var(--chart-2)",
  },
  pending: {
    label: "Pending",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export const purchasePaymentChartConfig = {
  paid: {
    label: "Paid",
    color: "var(--chart-2)",
  },
  outstanding: {
    label: "Outstanding",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig
