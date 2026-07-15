import { InboxIcon, MapPinIcon, PhoneIcon } from "lucide-react"

import type { ArchInquiry } from "@/lib/portfolio/inquiries"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatInquiryDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function locationLabel(inquiry: ArchInquiry) {
  return [inquiry.city, inquiry.pincode].filter(Boolean).join(" - ")
}

export function PortfolioInquiriesWorkspace({
  inquiries,
}: {
  inquiries: ArchInquiry[]
}) {
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-2 pb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Contact inquiries
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Incoming public project inquiries from the JR Suthar & Designs contact
          page.
        </p>
      </div>

      {inquiries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[220px]">Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inquiries.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">
                        {inquiry.name}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <PhoneIcon className="size-3.5" />
                        {inquiry.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {locationLabel(inquiry) ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPinIcon className="size-3.5" />
                        {locationLabel(inquiry)}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[280px] max-w-xl whitespace-normal">
                    <p className="line-clamp-3 text-sm leading-6 text-foreground">
                      {inquiry.message}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        inquiry.status === "new" ? "default" : "secondary"
                      }
                      className="capitalize"
                    >
                      {inquiry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {formatInquiryDate(inquiry.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed bg-secondary/30 px-6 py-12 text-center">
          <div className="space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-background text-muted-foreground">
              <InboxIcon className="size-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">No inquiries yet</h2>
              <p className="text-sm text-muted-foreground">
                New public contact submissions will appear here.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
