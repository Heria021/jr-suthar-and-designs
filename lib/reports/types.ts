export type ReportMetric = {
  label: string
  value: number
  kind?: "money" | "number" | "percent"
}

export type SalesReportRow = {
  id: string
  sale_number: string
  customer_name: string
  sale_date: string
  total_amount: number
  paid_amount: number
  due_amount: number
  payment_status: string
}

export type PurchaseReportRow = {
  id: string
  purchase_number: string
  supplier_name: string
  purchase_date: string
  total_amount: number
  paid_amount: number
  due_amount: number
  payment_status: string
}

export type PaymentReportRow = {
  id: string
  payment_number: string
  contact_name: string
  direction: "in" | "out"
  amount: number
  payment_method: string
  payment_date: string
  status: string
}

export type StockReportRow = {
  id: string
  name: string
  sku: string | null
  unit_name: string
  stock_on_hand: number
  reorder_level: number
  loose_cost_price: number
  stock_value: number
  stock_status: "Out of stock" | "Low stock" | "In stock"
}

export type BalanceReportRow = {
  id: string
  name: string
  phone: string | null
  contact_type: string
  customer_balance: number
  supplier_balance: number
}

export type ProfitProductRow = {
  product_id: string
  product_name: string
  quantity: number
  revenue: number
  cost: number
  gross_profit: number
}

export type ReportsData = {
  periodLabel: string
  sales: {
    metrics: ReportMetric[]
    rows: SalesReportRow[]
  }
  purchases: {
    metrics: ReportMetric[]
    rows: PurchaseReportRow[]
  }
  payments: {
    metrics: ReportMetric[]
    rows: PaymentReportRow[]
  }
  stock: {
    metrics: ReportMetric[]
    rows: StockReportRow[]
  }
  balances: {
    metrics: ReportMetric[]
    rows: BalanceReportRow[]
  }
  profit: {
    metrics: ReportMetric[]
    rows: ProfitProductRow[]
  }
}
