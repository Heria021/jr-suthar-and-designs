import Image from "next/image"

import { businessProfile } from "@/lib/invoice/business-profile"
import type { SaleInvoiceData } from "@/lib/invoice/sales"

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

function money(value: number) {
  return moneyFormatter.format(Number(value))
}

function quantityLabel(item: SaleInvoiceData["items"][number]) {
  return item.entry_mode === "box"
    ? `${item.entered_quantity} box`
    : `${item.entered_quantity} /${item.unit_name || "unit"}`
}

export function InvoicePrint({ invoice }: { invoice: SaleInvoiceData }) {
  const invoiceDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(invoice.sale.sale_date))

  return (
    <main className="mx-auto flex min-h-screen max-w-[210mm] flex-col bg-white p-5 text-[12px] leading-normal text-black print:min-h-[267mm] print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
      <section className="border-b-2 border-black pb-4">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight">
              {businessProfile.name}
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-zinc-700">
              {businessProfile.tagline}
            </p>
            <div className="mt-2 space-y-0.5 text-[12px] text-zinc-700">
              <p>Phone: {businessProfile.phone}</p>
              <p>Email: {businessProfile.email}</p>
              <p className="font-mono font-semibold text-black">
                GSTIN: {businessProfile.gstin}
              </p>
            </div>
          </div>
          <div className="min-w-[220px] text-right">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-600">
              Estimate Invoice
            </p>
            <h2 className="mt-2 text-[22px] font-bold tracking-tight">
              {invoice.sale.sale_number}
            </h2>
            <div className="mt-3 space-y-1 text-[12px]">
              <p>
                Date: <strong>{invoiceDate}</strong>
              </p>
              <p>
                Status:{" "}
                <strong className="capitalize">
                  {invoice.balance.payment_status.replaceAll("_", " ")}
                </strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 py-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
            From
          </p>
          <p className="font-bold">{businessProfile.name}</p>
          {businessProfile.addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-600">
            Bill To
          </p>
          <p className="font-bold">{invoice.customer.name}</p>
          {invoice.customer.address ? <p>{invoice.customer.address}</p> : null}
          <p>Phone: {invoice.customer.phone ?? "-"}</p>
          {invoice.customer.notes ? (
            <p className="mt-1 text-zinc-600">Notes: {invoice.customer.notes}</p>
          ) : null}
        </div>
      </section>

      <table className="mt-3 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-black text-left text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-700">
            <th className="w-12 py-2">Sr</th>
            <th>Product</th>
            <th className="text-center">Qty</th>
            <th className="text-right">RATE</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={item.id} className="border-b border-zinc-200 align-middle">
              <td className="py-2">{String(index + 1).padStart(2, "0")}</td>
              <td className="py-2 font-medium">{item.product_name_snapshot}</td>
              <td className="py-2 text-center">{quantityLabel(item)}</td>
              <td className="py-2 text-right">
                {money(item.price_per_entry)}
              </td>
              <td className="py-2 text-right font-semibold">
                {money(item.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-5 grid grid-cols-[1fr_270px] gap-8">
        <div className="space-y-4">
          {invoice.sale.notes ? (
            <div className="max-w-[360px] text-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">
                Bill Notes
              </p>
              <p className="mt-1">{invoice.sale.notes}</p>
            </div>
          ) : null}
        </div>
        <div className="space-y-2 text-[12px]">
          <SummaryRow label="Subtotal" value={money(invoice.sale.subtotal)} />
          <SummaryRow
            label="Discount"
            value={`- ${money(invoice.sale.discount_amount)}`}
          />
          <div className="border-y-2 border-black py-3">
            <SummaryRow
              label="Grand Total"
              value={money(invoice.sale.total_amount)}
              strong
            />
          </div>
          <SummaryRow
            label="Amount Paid"
            value={`- ${money(invoice.balance.paid_amount)}`}
          />
          <div className="border-y border-dashed border-black py-2">
            <SummaryRow
              label="Balance Due"
              value={money(invoice.balance.due_amount)}
              strong
            />
          </div>
        </div>
      </section>

      <footer className="mt-auto pt-6">
        <section className="flex items-end justify-between gap-8 border-t border-black pt-4 text-[12px]">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
              BANK DETAILS
            </p>
            <p>
              <strong>Bank Name:</strong> {businessProfile.bank.name}
            </p>
            <p>
              <strong>A/C Name:</strong> {businessProfile.bank.accountName}
            </p>
            <p>
              <strong>Account No:</strong> {businessProfile.bank.accountNumber}
            </p>
            <p>
              <strong>IFSC Code:</strong> {businessProfile.bank.ifsc}
            </p>
          </div>
          <div className="flex items-end gap-4 text-right">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
                UPI PAYMENT
              </p>
              <p className="mt-2 text-base font-semibold">
                {money(invoice.balance.due_amount)}
              </p>
              <p className="mt-2 max-w-44 text-[12px] text-zinc-600">
                Scan QR to pay Narayani Traders
              </p>
            </div>
            <Image
              src={businessProfile.payment.qrPublicPath}
              alt="Narayani Traders UPI QR code"
              width={96}
              height={96}
              loading="eager"
              className="size-24 shrink-0 object-contain"
            />
          </div>
        </section>
        <section className="mt-4 border-t border-dashed border-black pt-3 text-[12px]">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
            TERMS & CONDITIONS
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Goods once sold will not be taken back or exchanged without prior approval.</li>
            <li>Payment for Udhaar bills is due within 30 days of invoice date.</li>
          </ul>
        </section>
        <p className="mt-3 text-center text-[12px] italic text-zinc-600">
          Thank you for your business!
        </p>
      </footer>
    </main>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className={strong ? "flex justify-between text-base font-bold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
