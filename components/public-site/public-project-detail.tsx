"use client"

import Link from "next/link"
import { ArrowLeftIcon, MapPinIcon } from "lucide-react"
import { motion } from "motion/react"

import { Badge } from "@/components/ui/badge"
import type { PublicPortfolioProject } from "@/lib/portfolio/public-data"
import { projectTypeLabels } from "@/lib/portfolio/types"

function projectTitle(project: PublicPortfolioProject) {
  return (
    project.public_title ||
    [projectTypeLabels[project.project_type], project.location]
      .filter(Boolean)
      .join(" - ")
  )
}

export function PublicProjectDetail({
  project,
}: {
  project: PublicPortfolioProject
}) {
  const title = projectTitle(project)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative min-h-[72svh] overflow-hidden bg-primary text-primary-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={project.cover?.signed_url || "/pexels-ahmetcotur-31817155.jpg"}
          alt={title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/55 to-primary/10" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-primary/55 to-transparent" />
        <div className="relative z-10 mx-auto flex min-h-[72svh] w-full max-w-7xl items-end px-4 pb-12 pt-10 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <Link
              href="/#projects"
              className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-primary-foreground/75 transition-colors hover:text-primary-foreground"
            >
              <ArrowLeftIcon className="size-4" />
              Projects
            </Link>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="rounded border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground backdrop-blur hover:bg-primary-foreground/20">
                {projectTypeLabels[project.project_type]}
              </Badge>
              {project.location ? (
                <span className="inline-flex items-center gap-1 rounded bg-primary-foreground/10 px-2 py-1 text-xs font-medium text-primary-foreground/85 backdrop-blur">
                  <MapPinIcon className="size-3" />
                  {project.location}
                </span>
              ) : null}
            </div>
            <h1 className="text-5xl font-semibold leading-none tracking-tight sm:text-7xl">
              {title}
            </h1>
            {project.public_description ? (
              <p className="mt-6 max-w-2xl text-base leading-7 text-primary-foreground/75 sm:text-lg">
                {project.public_description}
              </p>
            ) : null}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Gallery
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Project images
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {project.media.length} published image
            {project.media.length === 1 ? "" : "s"}
          </p>
        </div>

        {project.media.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2">
            {project.media.map((media, index) => (
              <motion.figure
                key={media.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.2) }}
                className="overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-border/70"
              >
                <div className="aspect-video overflow-hidden bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media.signed_url || "/pexels-ahmetcotur-31817155.jpg"}
                    alt={`${title} image ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              </motion.figure>
            ))}
          </div>
        ) : (
          <div className="flex min-h-60 items-center justify-center rounded-lg border border-dashed bg-card px-6 text-center">
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              No public images are available for this project yet.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
