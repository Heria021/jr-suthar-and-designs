import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"

import { ContactInquiryForm } from "@/components/public-site/contact-inquiry-form"

export const metadata: Metadata = {
  title: "Contact | JR Suthar & Designs",
  description:
    "Send a project inquiry to JR Suthar & Designs with your contact details, location, and message.",
}

export default function ArchitectureContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto grid min-h-svh w-full max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12">
        <div className="space-y-8">
          <Link
            href="/architecture"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Architecture
          </Link>

          <div>
            <h1 className="text-5xl font-semibold leading-none tracking-tight sm:text-7xl">
              <span className="block">Contact the studio</span>
              <span className="block text-foreground/60">
                for project inquiries.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
              Send your name, contact number, location, and a short message
              about the work. The inquiry will be saved directly for the studio
              team to review.
            </p>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                <PhoneIcon className="size-4" />
              </span>
              Contact number collected in the form
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                <MapPinIcon className="size-4" />
              </span>
              City and pincode help plan the next step
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                <MailIcon className="size-4" />
              </span>
              jrsutharanddesigns@gmail.com
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
          <ContactInquiryForm />
        </div>
      </section>
    </main>
  )
}
