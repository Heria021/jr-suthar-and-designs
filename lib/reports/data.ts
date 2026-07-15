import "server-only"

import { createClient } from "@/lib/supabase/server"
import type {
  BalanceReportRow,
  PaymentReportRow,
  ProfitProductRow,
  PurchaseReportRow,
  ReportsData,
  SalesReportRow,
  StockReportRow,
} from "@/lib/reports/types"

const REPORT_TIMEZONE = "Asia/Kolkata"

function localDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: REPORT_TIMEZONE,
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value), 0)
}

export async function getReportsData(): Promise<ReportsData> {
  const supabase = await createClient()
  const today = localDateString(new Date())
  const startDate = monthStart(today)

  const [
    { data: contacts, error: contactsError },
    { data: contactBalances, error: contactBalancesError },
    { data: sales, error: salesError },
    { data: saleBalances, error: saleBalancesError },
    { data: purchases, error: purchasesError },
    { data: purchaseBalances, error: purchaseBalancesError },
    { data: payments, error: paymentsError },
    { data: products, error: productsError },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id,name,phone,contact_type,is_active")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("contact_balances")
      .select("contact_id,customer_balance,supplier_balance"),
    supabase
      .from("sales")
      .select("id,sale_number,sale_date,total_amount,customer_id,status,created_at")
      .eq("status", "finalized")
      .gte("sale_date", startDate)
      .lte("sale_date", today)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("sale_balances")
      .select("sale_id,paid_amount,due_amount,payment_status"),
    supabase
      .from("purchases")
      .select(
        "id,purchase_number,purchase_date,total_amount,supplier_id,status,created_at"
      )
      .eq("status", "finalized")
      .gte("purchase_date", startDate)
      .lte("purchase_date", today)
      .order("purchase_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_balances")
      .select("purchase_id,paid_amount,due_amount,payment_status"),
    supabase
      .from("payments")
      .select(
        "id,payment_number,contact_id,direction,amount,payment_method,payment_date,status,created_at"
      )
      .gte("payment_date", startDate)
      .lte("payment_date", today)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select(
        "id,name,sku,unit_name,stock_on_hand,reorder_level,loose_cost_price,is_active"
      )
      .eq("is_active", true)
      .order("name"),
  ])

  const firstError =
    contactsError ??
    contactBalancesError ??
    salesError ??
    saleBalancesError ??
    purchasesError ??
    purchaseBalancesError ??
    paymentsError ??
    productsError

  if (firstError) throw new Error(firstError.message)

  const contactMap = new Map((contacts ?? []).map((contact) => [contact.id, contact]))
  const saleBalanceMap = new Map(
    (saleBalances ?? []).map((balance) => [balance.sale_id, balance])
  )
  const purchaseBalanceMap = new Map(
    (purchaseBalances ?? []).map((balance) => [balance.purchase_id, balance])
  )

  const salesRows: SalesReportRow[] = (sales ?? []).map((sale) => {
    const balance = saleBalanceMap.get(sale.id)
    return {
      id: sale.id,
      sale_number: sale.sale_number,
      customer_name: contactMap.get(sale.customer_id)?.name ?? "Customer",
      sale_date: sale.sale_date,
      total_amount: Number(sale.total_amount),
      paid_amount: Number(balance?.paid_amount ?? 0),
      due_amount: Number(balance?.due_amount ?? 0),
      payment_status: balance?.payment_status ?? "Pending",
    }
  })

  const purchaseRows: PurchaseReportRow[] = (purchases ?? []).map((purchase) => {
    const balance = purchaseBalanceMap.get(purchase.id)
    return {
      id: purchase.id,
      purchase_number: purchase.purchase_number,
      supplier_name: contactMap.get(purchase.supplier_id)?.name ?? "Supplier",
      purchase_date: purchase.purchase_date,
      total_amount: Number(purchase.total_amount),
      paid_amount: Number(balance?.paid_amount ?? 0),
      due_amount: Number(balance?.due_amount ?? 0),
      payment_status: balance?.payment_status ?? "Pending",
    }
  })

  const paymentRows: PaymentReportRow[] = (payments ?? []).map((payment) => ({
    id: payment.id,
    payment_number: payment.payment_number,
    contact_name: contactMap.get(payment.contact_id)?.name ?? "Contact",
    direction: payment.direction as "in" | "out",
    amount: Number(payment.amount),
    payment_method: payment.payment_method,
    payment_date: payment.payment_date,
    status: payment.status,
  }))

  const stockRows: StockReportRow[] = (products ?? []).map((product) => {
    const stock = Number(product.stock_on_hand)
    const reorder = Number(product.reorder_level)
    const cost = Number(product.loose_cost_price)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit_name: product.unit_name,
      stock_on_hand: stock,
      reorder_level: reorder,
      loose_cost_price: cost,
      stock_value: stock * cost,
      stock_status:
        stock === 0 ? "Out of stock" : stock <= reorder ? "Low stock" : "In stock",
    }
  })

  const balanceMap = new Map(
    (contactBalances ?? []).map((balance) => [balance.contact_id, balance])
  )
  const balanceRows: BalanceReportRow[] = (contacts ?? [])
    .map((contact) => {
      const balance = balanceMap.get(contact.id)
      return {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        contact_type: contact.contact_type,
        customer_balance: Number(balance?.customer_balance ?? 0),
        supplier_balance: Number(balance?.supplier_balance ?? 0),
      }
    })
    .filter((row) => row.customer_balance !== 0 || row.supplier_balance !== 0)
    .sort(
      (a, b) =>
        Math.max(b.customer_balance, b.supplier_balance) -
        Math.max(a.customer_balance, a.supplier_balance)
    )

  const saleIds = (sales ?? []).map((sale) => sale.id)
  const { data: saleItems, error: saleItemsError } = saleIds.length
    ? await supabase
        .from("sale_items")
        .select("product_id,product_name_snapshot,base_quantity,line_total,cost_total_snapshot")
        .in("sale_id", saleIds)
    : { data: [], error: null }

  if (saleItemsError) throw new Error(saleItemsError.message)

  const productProfitMap = new Map<string, ProfitProductRow>()
  for (const item of saleItems ?? []) {
    const current = productProfitMap.get(item.product_id) ?? {
      product_id: item.product_id,
      product_name: item.product_name_snapshot,
      quantity: 0,
      revenue: 0,
      cost: 0,
      gross_profit: 0,
    }
    current.quantity += Number(item.base_quantity)
    current.revenue += Number(item.line_total)
    current.cost += Number(item.cost_total_snapshot)
    current.gross_profit = current.revenue - current.cost
    productProfitMap.set(item.product_id, current)
  }

  const profitRows = [...productProfitMap.values()]
    .sort((a, b) => b.gross_profit - a.gross_profit)
    .slice(0, 20)

  const salesTotal = sum(salesRows.map((row) => row.total_amount))
  const salesPaid = sum(salesRows.map((row) => row.paid_amount))
  const purchaseTotal = sum(purchaseRows.map((row) => row.total_amount))
  const purchasePaid = sum(purchaseRows.map((row) => row.paid_amount))
  const received = sum(
    paymentRows
      .filter((row) => row.direction === "in")
      .map((row) => row.amount)
  )
  const paid = sum(
    paymentRows
      .filter((row) => row.direction === "out")
      .map((row) => row.amount)
  )
  const stockValue = sum(stockRows.map((row) => row.stock_value))
  const revenue = salesTotal
  const cost = sum((saleItems ?? []).map((item) => Number(item.cost_total_snapshot)))
  const grossProfit = revenue - cost
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  return {
    periodLabel: monthLabel(startDate),
    sales: {
      metrics: [
        { label: "Bills", value: salesRows.length, kind: "number" },
        { label: "Billed", value: salesTotal, kind: "money" },
        { label: "Collected", value: salesPaid, kind: "money" },
        { label: "Pending", value: sum(salesRows.map((row) => row.due_amount)), kind: "money" },
      ],
      rows: salesRows,
    },
    purchases: {
      metrics: [
        { label: "Purchases", value: purchaseRows.length, kind: "number" },
        { label: "Purchased", value: purchaseTotal, kind: "money" },
        { label: "Paid", value: purchasePaid, kind: "money" },
        { label: "Outstanding", value: sum(purchaseRows.map((row) => row.due_amount)), kind: "money" },
      ],
      rows: purchaseRows,
    },
    payments: {
      metrics: [
        { label: "Payments", value: paymentRows.length, kind: "number" },
        { label: "Received", value: received, kind: "money" },
        { label: "Paid", value: paid, kind: "money" },
        { label: "Net", value: received - paid, kind: "money" },
      ],
      rows: paymentRows,
    },
    stock: {
      metrics: [
        { label: "Products", value: stockRows.length, kind: "number" },
        { label: "Stock units", value: sum(stockRows.map((row) => row.stock_on_hand)), kind: "number" },
        { label: "Stock value", value: stockValue, kind: "money" },
        { label: "Low stock", value: stockRows.filter((row) => row.stock_status !== "In stock").length, kind: "number" },
      ],
      rows: stockRows,
    },
    balances: {
      metrics: [
        { label: "Contacts", value: balanceRows.length, kind: "number" },
        { label: "Customers due", value: sum(balanceRows.map((row) => Math.max(row.customer_balance, 0))), kind: "money" },
        { label: "Suppliers payable", value: sum(balanceRows.map((row) => Math.max(row.supplier_balance, 0))), kind: "money" },
        { label: "Net receivable", value: sum(balanceRows.map((row) => row.customer_balance - row.supplier_balance)), kind: "money" },
      ],
      rows: balanceRows,
    },
    profit: {
      metrics: [
        { label: "Revenue", value: revenue, kind: "money" },
        { label: "Cost", value: cost, kind: "money" },
        { label: "Gross profit", value: grossProfit, kind: "money" },
        { label: "Margin", value: margin, kind: "percent" },
      ],
      rows: profitRows,
    },
  }
}
