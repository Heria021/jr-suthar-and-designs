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

export function InvoicePrint({ invoice }: { invoice: SaleInvoiceData }) {
  const invoiceDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(invoice.sale.sale_date))

  return (
    <main className="mx-auto flex min-h-screen max-w-[210mm] flex-col bg-white p-6 text-[13px] leading-relaxed text-black print:min-h-[267mm] print:p-0">
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 16mm; }
        }
      `}</style>
      <section className="border-b-2 border-black pb-5">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {businessProfile.name}
            </h1>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.22em] text-zinc-700">
              {businessProfile.tagline}
            </p>
            <div className="mt-3 space-y-0.5 text-sm text-zinc-700">
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
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              {invoice.sale.sale_number}
            </h2>
            <div className="mt-4 space-y-1 text-sm">
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

      <section className="grid grid-cols-2 gap-8 border-b border-black py-5">
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

      <table className="mt-5 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs font-bold uppercase tracking-[0.14em]">
            <th className="w-12 py-3">#</th>
            <th>Product</th>
            <th className="text-right">Mode</th>
            <th className="text-right">Qty</th>
            <th className="text-right">RATE</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={item.id} className="border-b border-zinc-200">
              <td className="py-3">{String(index + 1).padStart(2, "0")}</td>
              <td className="font-medium">{item.product_name_snapshot}</td>
              <td className="text-right capitalize">{item.entry_mode}</td>
              <td className="text-right">{item.entered_quantity}</td>
              <td className="text-right">
                {money(item.price_per_entry)}
              </td>
              <td className="text-right font-semibold">
                {money(item.line_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="mt-7 grid grid-cols-[1fr_280px] gap-8">
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
        <div className="space-y-3 text-sm">
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

      <footer className="mt-auto pt-8">
        <section className="rounded-md border border-black px-4 py-3 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
            TERMS & CONDITIONS
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Goods once sold will not be taken back or exchanged without prior approval.</li>
            <li>Payment for Udhaar bills is due within 30 days of invoice date.</li>
          </ul>
        </section>

        <section className="mt-3 flex items-end justify-between gap-8 border-t border-black pt-4 text-sm">
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
              <p className="mt-2 text-lg font-semibold">
                {money(invoice.balance.due_amount)}
              </p>
              <p className="mt-2 max-w-44 text-sm text-zinc-600">
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
        <p className="mt-4 border-t border-dashed border-black pt-3 text-center text-sm italic text-zinc-600">
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
    <div className={strong ? "flex justify-between text-lg font-bold" : "flex justify-between"}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
