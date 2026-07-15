export type WeeklySalesPoint = {
  date: string
  label: string
  sales: number
}

export type PeriodComparison = {
  current: number
  previous: number
  changePercent: number | null
  changeAmount: number
}

export type DonutSummary = {
  total: number
  primary: number
  secondary: number
  count: number
}

export type AttentionContact = {
  id: string
  name: string
  amount: number
}

export type AttentionProduct = {
  id: string
  name: string
  unit_name: string
  stock_on_hand: number
  reorder_level: number
}

export type DashboardOverviewData = {
  timezone: string
  lastSevenDaysLabel: string
  currentMonthLabel: string
  weeklySales: {
    points: WeeklySalesPoint[]
    comparison: PeriodComparison
  }
  salesCollection: DonutSummary
  purchasePayments: DonutSummary
  attention: {
    customersDue: AttentionContact[]
    suppliersPayable: AttentionContact[]
    lowStockProducts: AttentionProduct[]
  }
}
