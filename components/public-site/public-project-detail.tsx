"use client"

import Link from "next/link"
import { motion } from "motion/react"

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

function projectDescription(project: PublicPortfolioProject) {
  return (
    project.public_description ||
    "A public portfolio project shaped through practical planning, proportion, and considered material decisions."
  )
}

export function PublicProjectDetail({
  project,
}: {
  project: PublicPortfolioProject
}) {
  const title = projectTitle(project)
  const description = projectDescription(project)

  return (
    <main className="public-light-theme min-h-screen bg-background text-foreground">
      <section className="w-full px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <Link
          href="/#projects"
          className="inline-flex h-9 items-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
        >
          Projects
        </Link>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="max-w-6xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
              <span className="block">{title}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
              {description}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="space-y-3 text-sm"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium text-foreground">
                {projectTypeLabels[project.project_type]}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Location</span>
              <span className="text-right font-medium text-foreground">
                {project.location || "Rajasthan"}
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="w-full px-5 pb-20 pt-8 sm:px-8 lg:px-12 lg:pb-28">
        {project.media.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-3">
            {project.media.map((media, index) => {
              const wide = index === 0 || index % 5 === 3

              return (
                <motion.figure
                  key={media.id}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.5,
                    delay: Math.min(index * 0.05, 0.2),
                  }}
                  className={wide ? "md:col-span-2" : undefined}
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/70 md:aspect-[16/10]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        media.signed_url || "/pexels-ahmetcotur-31817155.jpg"
                      }
                      alt={`${title} image ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </motion.figure>
              )
            })}
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
