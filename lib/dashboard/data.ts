import "server-only"

import { createClient } from "@/lib/supabase/server"
import type {
  AttentionContact,
  AttentionProduct,
  DashboardOverviewData,
  WeeklySalesPoint,
} from "@/lib/dashboard/types"

const DASHBOARD_TIMEZONE = "Asia/Kolkata"

function localDateString(date: Date, timezone = DASHBOARD_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`
}

function dateRange(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDays(start, index))
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    timeZone: DASHBOARD_TIMEZONE,
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function monthLabel(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: DASHBOARD_TIMEZONE,
  }).format(new Date(`${date}T00:00:00.000Z`))
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value), 0)
}

export async function getDashboardOverview(): Promise<DashboardOverviewData> {
  const supabase = await createClient()
  const today = localDateString(new Date())
  const lastSevenStart = addDays(today, -6)
  const previousSevenStart = addDays(today, -13)
  const previousSevenEnd = addDays(today, -7)
  const currentMonthStart = monthStart(today)

  const [
    { data: comparisonSales, error: comparisonSalesError },
    { data: monthSales, error: monthSalesError },
    { data: saleBalances, error: saleBalancesError },
    { data: monthPurchases, error: monthPurchasesError },
    { data: purchaseBalances, error: purchaseBalancesError },
    { data: contacts, error: contactsError },
    { data: contactBalances, error: contactBalancesError },
    { data: lowStockProducts, error: lowStockError },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("id,sale_date,total_amount")
      .eq("status", "finalized")
      .gte("sale_date", previousSevenStart)
      .lte("sale_date", today),
    supabase
      .from("sales")
      .select("id,sale_number,sale_date,total_amount,customer_id,status,created_at")
      .eq("status", "finalized")
      .gte("sale_date", currentMonthStart)
      .lte("sale_date", today),
    supabase.from("sale_balances").select("sale_id,paid_amount,due_amount"),
    supabase
      .from("purchases")
      .select(
        "id,purchase_number,purchase_date,total_amount,supplier_id,status,created_at"
      )
      .eq("status", "finalized")
      .gte("purchase_date", currentMonthStart)
      .lte("purchase_date", today),
    supabase
      .from("purchase_balances")
      .select("purchase_id,paid_amount,due_amount"),
    supabase
      .from("contacts")
      .select("id,name,phone,contact_type,is_active")
      .eq("is_active", true),
    supabase
      .from("contact_balances")
      .select("contact_id,customer_balance,supplier_balance"),
    supabase
      .from("products")
      .select("id,name,unit_name,stock_on_hand,reorder_level")
      .eq("is_active", true)
      .order("stock_on_hand", { ascending: true })
      .order("name")
      .limit(100),
  ])

  const firstError =
    comparisonSalesError ??
    monthSalesError ??
    saleBalancesError ??
    monthPurchasesError ??
    purchaseBalancesError ??
    contactsError ??
    contactBalancesError ??
    lowStockError

  if (firstError) {
    throw new Error(firstError.message)
  }

  const sevenDayDates = dateRange(lastSevenStart, 7)
  const weeklyTotals = new Map(sevenDayDates.map((date) => [date, 0]))
  let previousTotal = 0

  for (const sale of comparisonSales ?? []) {
    const amount = Number(sale.total_amount)
    if (sale.sale_date >= lastSevenStart && sale.sale_date <= today) {
      weeklyTotals.set(sale.sale_date, (weeklyTotals.get(sale.sale_date) ?? 0) + amount)
    } else if (
      sale.sale_date >= previousSevenStart &&
      sale.sale_date <= previousSevenEnd
    ) {
      previousTotal += amount
    }
  }

  const weeklyPoints: WeeklySalesPoint[] = sevenDayDates.map((date) => ({
    date,
    label: dayLabel(date),
    sales: weeklyTotals.get(date) ?? 0,
  }))
  const weeklyCurrent = sum(weeklyPoints.map((point) => point.sales))

  const monthSaleIds = new Set((monthSales ?? []).map((sale) => sale.id))
  const monthPurchaseIds = new Set((monthPurchases ?? []).map((purchase) => purchase.id))

  const salesTotal = sum((monthSales ?? []).map((sale) => Number(sale.total_amount)))
  const salesCollected = sum(
    (saleBalances ?? [])
      .filter((balance) => monthSaleIds.has(balance.sale_id))
      .map((balance) => Number(balance.paid_amount))
  )
  const purchaseTotal = sum(
    (monthPurchases ?? []).map((purchase) => Number(purchase.total_amount))
  )
  const purchasePaid = sum(
    (purchaseBalances ?? [])
      .filter((balance) => monthPurchaseIds.has(balance.purchase_id))
      .map((balance) => Number(balance.paid_amount))
  )

  const contactBalanceMap = new Map(
    (contactBalances ?? []).map((balance) => [balance.contact_id, balance])
  )

  const customersDue: AttentionContact[] = (contacts ?? [])
    .filter((contact) =>
      ["customer", "both", "walk_in"].includes(contact.contact_type)
    )
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      amount: Number(contactBalanceMap.get(contact.id)?.customer_balance ?? 0),
    }))
    .filter((contact) => contact.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const suppliersPayable: AttentionContact[] = (contacts ?? [])
    .filter((contact) => ["supplier", "both"].includes(contact.contact_type))
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      amount: Number(contactBalanceMap.get(contact.id)?.supplier_balance ?? 0),
    }))
    .filter((contact) => contact.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const sortedLowStockProducts: AttentionProduct[] = (lowStockProducts ?? [])
    .map((product) => ({
      id: product.id,
      name: product.name,
      unit_name: product.unit_name,
      stock_on_hand: Number(product.stock_on_hand),
      reorder_level: Number(product.reorder_level),
    }))
    .filter((product) => product.stock_on_hand <= product.reorder_level)
    .sort((a, b) => {
      if (a.stock_on_hand === 0 && b.stock_on_hand !== 0) return -1
      if (a.stock_on_hand !== 0 && b.stock_on_hand === 0) return 1
      const aRatio = a.stock_on_hand / Math.max(a.reorder_level, 1)
      const bRatio = b.stock_on_hand / Math.max(b.reorder_level, 1)
      if (aRatio !== bRatio) return aRatio - bRatio
      return a.name.localeCompare(b.name)
    })
    .slice(0, 5)

  return {
    timezone: DASHBOARD_TIMEZONE,
    lastSevenDaysLabel: "Last 7 days",
    currentMonthLabel: monthLabel(currentMonthStart),
    weeklySales: {
      points: weeklyPoints,
      comparison: {
        current: weeklyCurrent,
        previous: previousTotal,
        changeAmount: weeklyCurrent - previousTotal,
        changePercent:
          previousTotal > 0
            ? ((weeklyCurrent - previousTotal) / previousTotal) * 100
            : null,
      },
    },
    salesCollection: {
      total: salesTotal,
      primary: Math.min(salesCollected, salesTotal),
      secondary: Math.max(salesTotal - salesCollected, 0),
      count: monthSaleIds.size,
    },
    purchasePayments: {
      total: purchaseTotal,
      primary: Math.min(purchasePaid, purchaseTotal),
      secondary: Math.max(purchaseTotal - purchasePaid, 0),
      count: monthPurchaseIds.size,
    },
    attention: {
      customersDue,
      suppliersPayable,
      lowStockProducts: sortedLowStockProducts,
    },
  }
}
