"use client"

import Link from "next/link"
import Image from "next/image"
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

function projectHref(project: PublicPortfolioProject) {
  return `/projects/${project.id}`
}

const heroItem = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7 },
  },
}

const easeOutExpo = [0.22, 1, 0.36, 1] as const
const studioImage = "/pexels-ahmetcotur-31817155.jpg"

const services = [
  {
    title: "Architecture",
    description:
      "Clear planning, proportion, and built form for homes, studios, and commercial spaces.",
  },
  {
    title: "Interior Design",
    description:
      "Material-led interiors shaped around light, movement, storage, and everyday comfort.",
  },
  {
    title: "Renovation",
    description:
      "Thoughtful upgrades that keep what works and resolve what needs to perform better.",
  },
  {
    title: "Visualization",
    description:
      "Clean project visuals that help decisions feel grounded before execution begins.",
  },
]

export function PortfolioLanding({
  projects,
}: {
  projects: PublicPortfolioProject[]
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="relative flex min-h-svh overflow-hidden bg-primary text-primary-foreground">
        <motion.img
          src="/pexels-ahmetcotur-31817155.jpg"
          alt="Modern luxury interior with open glass facade"
          initial={{ scale: 1.04 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4 }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/70 to-primary/10" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-primary/70 to-transparent" />

        <div className="relative z-10 flex min-h-svh w-full flex-col px-5 py-8 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-sm font-medium tracking-wide text-primary-foreground/80"
          >
            JR Suthar & Designs
          </motion.div>

          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.12, delayChildren: 0.18 }}
            className="mt-auto w-full pb-6 sm:pb-10"
          >
            <motion.h1
              variants={heroItem}
              className="max-w-6xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl"
            >
              <span className="block">Spaces designed</span>
              <span className="block text-primary-foreground/60">
                with quiet precision.
              </span>
            </motion.h1>
            <motion.p
              variants={heroItem}
              className="mt-5 max-w-lg text-sm leading-6 text-primary-foreground/70"
            >
              Quiet, considered spaces shaped through proportion, material
              clarity, and practical everyday use.
            </motion.p>
            <motion.div
              variants={heroItem}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <a
                href="#projects"
                className="inline-flex h-11 items-center rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-5 text-sm font-semibold text-primary-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-primary-foreground/20"
              >
                View projects
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section
        id="projects"
        className="w-full px-5 pb-16 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pt-40"
      >
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <motion.h2
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, ease: easeOutExpo }}
            className="max-w-5xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl"
          >
            <span className="block">Projects shaped</span>
            <span className="block text-foreground/60">
              by light and material.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, delay: 0.08, ease: easeOutExpo }}
            className="max-w-md text-sm leading-6 text-muted-foreground md:text-right"
          >
            A focused portfolio of public projects, maintained directly from the
            design workspace.
          </motion.p>
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-3">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-60 items-center justify-center rounded-lg border border-dashed bg-card px-6 text-center">
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              No public projects are available yet. Mark projects and images as
              public from the dashboard to publish them here.
            </p>
          </div>
        )}
      </section>

      <section className="w-full px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-end">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, ease: easeOutExpo }}
            className="max-w-4xl"
          >
            <h2 className="text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
              <span className="block">About the studio</span>
              <span className="block text-foreground/60">
                philosophy in practice.
              </span>
            </h2>
            <div className="mt-8 grid gap-5 text-sm leading-6 text-muted-foreground sm:grid-cols-2 lg:max-w-3xl">
              <p>
                JR Suthar & Designs works across architecture, interiors, and
                renovation with a focus on spaces that feel calm, precise, and
                practical to live with.
              </p>
              <p>
                The studio balances proportion, material clarity, and execution
                detail so every decision supports the way a space is used every
                day.
              </p>
            </div>
            <Link
              href="/architecture"
              className="mt-8 inline-flex h-11 items-center rounded-full border bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Studio profile
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, delay: 0.08, ease: easeOutExpo }}
            className="relative min-h-96 overflow-hidden rounded-lg bg-muted ring-1 ring-border/70"
          >
            <Image
              src={studioImage}
              alt="JR Suthar and Designs studio philosophy reference interior"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </motion.div>
        </div>
      </section>

      <section className="w-full px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <motion.h2
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, ease: easeOutExpo }}
            className="max-w-5xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl"
          >
            <span className="block">Services for</span>
            <span className="block text-foreground/60">complete spaces.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.75, delay: 0.08, ease: easeOutExpo }}
            className="max-w-md text-sm leading-6 text-muted-foreground md:text-right"
          >
            From early planning to final interior decisions, each service is
            shaped to keep the project clear, buildable, and visually resolved.
          </motion.p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.65,
                delay: Math.min(index * 0.06, 0.24),
                ease: easeOutExpo,
              }}
              className="rounded-lg border bg-card p-5 text-card-foreground"
            >
              <h3 className="text-lg font-semibold">{service.title}</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {service.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="w-full px-5 pb-20 pt-10 sm:px-8 lg:px-12 lg:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.75, ease: easeOutExpo }}
          className="overflow-hidden rounded-lg bg-primary p-8 text-primary-foreground sm:p-10 lg:p-12"
        >
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="max-w-5xl text-5xl font-semibold leading-none tracking-tight sm:text-7xl lg:text-8xl">
                <span className="block">Start a project</span>
                <span className="block text-primary-foreground/60">
                  with JR Suthar & Designs.
                </span>
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-6 text-primary-foreground/70">
                Share the site, scope, or space you want to shape. The studio
                will respond with a clear next step for planning the work.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/architecture/contact"
                className="inline-flex h-11 items-center rounded-full bg-primary-foreground px-5 text-sm font-semibold text-primary shadow-sm transition-colors hover:bg-primary-foreground/90"
              >
                Contact studio
              </Link>
              <a
                href="#projects"
                className="inline-flex h-11 items-center rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-5 text-sm font-semibold text-primary-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-primary-foreground/20"
              >
                View projects
              </a>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  )
}

function ProjectCard({
  project,
  index,
}: {
  project: PublicPortfolioProject
  index: number
}) {
  const wide = index % 4 === 0 || index % 4 === 3

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.65,
        delay: Math.min(index * 0.06, 0.24),
        ease: easeOutExpo,
      }}
      className={wide ? "md:col-span-2" : undefined}
    >
      <Link
        href={projectHref(project)}
        className="group block overflow-hidden rounded-lg bg-card text-card-foreground shadow-sm ring-1 ring-border/70 transition-transform duration-300 hover:-translate-y-1"
      >
        <div className="relative flex min-h-96 overflow-hidden bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.cover?.signed_url || "/pexels-ahmetcotur-31817155.jpg"}
            alt={projectTitle(project)}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/10 to-transparent" />
          <h3 className="absolute inset-x-5 bottom-5 truncate text-2xl font-semibold uppercase tracking-widest text-primary-foreground sm:text-3xl">
            {projectTitle(project)}
          </h3>
        </div>
      </Link>
    </motion.div>
  )
}
