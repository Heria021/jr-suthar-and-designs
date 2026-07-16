import type { Metadata } from "next"
import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"

import { ContactInquiryForm } from "@/components/public-site/contact-inquiry-form"
import { PublicSiteHeader } from "@/components/public-site/public-site-header"

export const metadata: Metadata = {
  title: "Contact | JR Suthar & Designs",
  description:
    "Send a project inquiry to JR Suthar & Designs with your contact details, location, and message.",
}

export default function ArchitectureContactPage() {
  return (
    <main className="public-light-theme min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <section className="mx-auto w-full max-w-7xl px-5 pb-8 pt-28 sm:px-8 lg:px-12 lg:pb-16 lg:pt-32">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-x-16 lg:items-start">
          <div className="space-y-6 lg:max-w-lg">
            <h1 className="text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
              <span className="block">Contact the studio</span>
              <span className="block text-foreground/60">
                for project inquiries.
              </span>
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Share the basic details of your site, location, or interior
              requirement. Keep it simple; the studio can follow up with the
              right questions after reviewing the inquiry.
            </p>
          </div>

          <div className="w-full">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight">
                Project inquiry
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Name, contact number, city, pincode, and a short message are
                enough to begin.
              </p>
            </div>
            <ContactInquiryForm />
          </div>
        </div>

        <div className="mt-16 border-t pt-12 lg:mt-24">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                  <MapPinIcon className="size-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Studio Office
                </p>
              </div>
              <p className="text-sm leading-6 text-foreground pl-12">
                Ward No. 20, Near Aadhar Super Market, PWD Road, Dariba, Bidasar
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                  <MailIcon className="size-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Email
                </p>
              </div>
              <p className="text-sm leading-6 text-foreground pl-12">
                <a
                  href="mailto:jrsutharanddesigns@gmail.com"
                  className="text-foreground transition-colors hover:text-muted-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
                >
                  jrsutharanddesigns@gmail.com
                </a>
              </p>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-foreground">
                  <PhoneIcon className="size-4" />
                </span>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Contact
                </p>
              </div>
              <p className="text-sm leading-6 text-foreground pl-12">
                <a
                  href="tel:+919782353866"
                  className="text-foreground transition-colors hover:text-muted-foreground underline underline-offset-4 decoration-border hover:decoration-foreground"
                >
                  +91 97823 53866
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
