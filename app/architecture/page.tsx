import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Architecture Studio | JR Suthar & Designs",
  description:
    "Studio profile for JR Suthar & Designs, focused on architecture, interiors, renovation, and visualization.",
}

const studioImage = "/pexels-ahmetcotur-31817155.jpg"

export default function ArchitecturePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="grid min-h-svh w-full lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex min-h-[70svh] flex-col px-5 py-8 sm:px-8 lg:min-h-svh lg:px-12">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            Home
          </Link>

          <div className="mt-auto max-w-3xl pb-8 pt-20">
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
                className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
              >
                Start a project
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

        <div className="relative min-h-[70svh] overflow-hidden bg-muted lg:min-h-svh">
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

      <section className="w-full px-5 py-20 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <h2 className="text-4xl font-semibold leading-none tracking-tight sm:text-6xl">
            <span className="block">Studio details</span>
            <span className="block text-foreground/60">kept clear.</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Focus", "Architecture, interior design, renovation, and visualization."],
              ["Approach", "Measured planning, clean material choices, and execution-ready decisions."],
              ["Projects", "Residential, commercial, and custom design work."],
              ["Contact", "Share project details through the inquiry form for a clear next step."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-lg border bg-card p-5">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  {title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-card-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
