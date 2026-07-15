export const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export const preciseMoneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

export const numberFormatter = new Intl.NumberFormat("en-IN")

export const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
})

export function money(value: number) {
  return moneyFormatter.format(Number(value))
}

export function preciseMoney(value: number) {
  return preciseMoneyFormatter.format(Number(value))
}

export function numberText(value: number) {
  return numberFormatter.format(Number(value))
}
