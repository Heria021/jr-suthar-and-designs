import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { PublicSiteHeader } from "@/components/public-site/public-site-header"

export const metadata: Metadata = {
  title: "Architecture Studio | JR Suthar & Designs",
  description:
    "Studio profile for JR Suthar & Designs, focused on architecture, interiors, renovation, and visualization.",
}

const studioImage = "/pexels-ahmetcotur-31817155.jpg"

const architectDetails = [
  ["Role", "Architect"],
  ["Experience", "8+ years in residential and commercial design"],
  ["Speciality", "Architecture, interiors, renovation, and 3D visualization"],
  ["Studio Office", "Ward No. 20, Near Aadhar Super Market, PWD Road, Dariba, Bidasar"],
  ["Email", "jrsutharanddesigns@gmail.com"],
  ["Phone", "+91 97823 53866"],
]

const services = [
  {
    title: "Architecture",
    description:
      "Site planning, built form, spatial proportion, and design direction for practical, lasting spaces.",
  },
  {
    title: "Interior Design",
    description:
      "Interior layouts, material palettes, storage planning, lighting mood, and refined room experiences.",
  },
  {
    title: "Renovation",
    description:
      "Measured improvements for existing spaces with careful attention to structure, use, and finish.",
  },
  {
    title: "Visualization",
    description:
      "Clear visual studies that help align decisions before execution begins on site.",
  },
]

export default function ArchitecturePage() {
  return (
    <main className="public-light-theme min-h-screen bg-background text-foreground">
      <PublicSiteHeader />
      <section className="grid min-h-svh w-full lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-h-[72svh] flex-col px-5 py-8 sm:px-8 lg:min-h-svh lg:px-12">
          <div className="mt-auto max-w-4xl pb-10 pt-20">
            <h1 className="text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
              <span className="block">Architecture</span>
              <span className="block text-foreground/60">with restraint.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
              JR Suthar & Designs shapes architecture and interiors with a calm
              balance of proportion, material clarity, and practical execution.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/architecture/contact"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Start a project
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                href="/#projects"
                className="inline-flex h-11 items-center rounded-full border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                View projects
              </Link>
            </div>
          </div>
        </div>

        <div className="relative min-h-[72svh] overflow-hidden bg-muted lg:min-h-svh">
          <Image
            src={studioImage}
            alt="JR Suthar and Designs architecture studio placeholder"
            fill
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/45 via-transparent to-transparent" />
        </div>
      </section>

      <section className="w-full px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <h2 className="max-w-5xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
            <span className="block">Studio philosophy</span>
            <span className="block text-foreground/60">
              resolved through detail.
            </span>
          </h2>
          <div className="max-w-xl space-y-5 text-sm leading-6 text-muted-foreground lg:ml-auto lg:text-right">
            <p>
              The studio treats architecture as a careful balance between
              proportion, natural light, material restraint, and daily use.
            </p>
            <p>
              Each project is developed with a practical eye toward execution,
              so the design remains clear from the first plan to the finished
              space.
            </p>
          </div>
        </div>
      </section>

      <section className="w-full px-5 py-12 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div className="relative min-h-[32rem] overflow-hidden rounded-lg bg-muted">
            <Image
              src={studioImage}
              alt="Architect profile placeholder"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/35 via-transparent to-transparent" />
          </div>

          <div>
            <h2 className="mt-4 text-4xl font-semibold leading-none tracking-tight sm:text-6xl">
              <span className="block">Ramesh Suthar</span>
              <span className="block text-foreground/60">
                architect and design lead.
              </span>
            </h2>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-muted-foreground">
              Ramesh Suthar leads the studio&apos;s architecture and design work,
              shaping projects with a focus on practical planning, restrained
              details, and clear execution.
            </p>

            <div className="mt-8 divide-y rounded-lg border">
              {architectDetails.map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-2 px-4 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:pt-1">
                    {label}
                  </p>
                  <p className="text-sm leading-6 text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-4xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl">
            <span className="block">Services shaped</span>
            <span className="block text-foreground/60">for complete spaces.</span>
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground md:text-right">
            Clear scopes for architecture, interiors, renovation, and visual
            planning.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <div key={service.title} className="rounded-lg border bg-card p-5">
              <h3 className="text-lg font-semibold">{service.title}</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="w-full px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="rounded-lg bg-primary p-8 text-primary-foreground sm:p-10 lg:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="max-w-4xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl">
                <span className="block">Start a project</span>
                <span className="block text-primary-foreground/60">
                  with a clear brief.
                </span>
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-6 text-primary-foreground/70">
                Share the site, scope, and location so the studio can respond
                with a practical next step.
              </p>
            </div>

            <Link
              href="/architecture/contact"
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary-foreground/90"
            >
              Contact studio
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
