"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2Icon,
  EyeIcon,
  EyeOffIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react"

import type { ArchProject } from "@/lib/portfolio/types"
import { getArchProjectTitle, projectTypeLabels } from "@/lib/portfolio/types"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FilterValue = "all" | "public" | "private" | "featured"

const filters: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Public", value: "public" },
  { label: "Private", value: "private" },
  { label: "Featured", value: "featured" },
]

export function PortfolioOverviewWorkspace({
  projects,
}: {
  projects: ArchProject[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FilterValue>("all")

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return projects.filter((project) => {
      const title = getArchProjectTitle(project).toLowerCase()
      const matchesSearch =
        !term ||
        title.includes(term) ||
        project.client.name.toLowerCase().includes(term) ||
        project.location?.toLowerCase().includes(term) ||
        projectTypeLabels[project.project_type].toLowerCase().includes(term)

      const matchesFilter =
        filter === "all" ||
        (filter === "public" && project.is_public) ||
        (filter === "private" && !project.is_public) ||
        (filter === "featured" && project.is_featured)

      return matchesSearch && matchesFilter
    })
  }, [filter, projects, query])


  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            JR Suthar & Designs
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Architecture portfolio projects, clients, and project media.
          </p>
        </div>
        <Link
          href="/jr-suthar-and-designs/new"
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          <PlusIcon className="size-4" />
          New Project
        </Link>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects, clients, locations"
              className="h-9 bg-secondary/50 pl-9 shadow-none"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {filters.map((item) => {
              const selected = filter === item.value
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "h-8 shrink-0 rounded-md border px-3 text-xs font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => router.push(`/jr-suthar-and-designs/${project.id}`)}
                className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-secondary text-left"
              >
                {project.cover?.signed_url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={project.cover.signed_url}
                      alt={getArchProjectTitle(project)}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
                      {/* Left: title + city */}
                      <div className="min-w-0 space-y-0.5">
                        <h2 className="truncate text-sm font-bold uppercase tracking-wider">
                          {getArchProjectTitle(project)}
                        </h2>
                        <p className="truncate text-xs text-white/70">
                          {project.client.name}
                          {project.location ? ` · ${project.location}` : ""}
                        </p>
                      </div>
                      {/* Right: badges + featured star */}
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {project.is_featured ? (
                          <StarIcon className="size-3.5 fill-amber-400 text-amber-400" />
                        ) : null}
                        <Badge variant="secondary" className="rounded-md bg-white/20 text-white border-none text-[10px] px-1.5 py-0.5 backdrop-blur-xs">
                          {projectTypeLabels[project.project_type]}
                        </Badge>
                        <Badge variant="secondary" className="rounded-md bg-white/20 text-white border-none text-[10px] px-1.5 py-0.5 backdrop-blur-xs">
                          {project.is_public ? (
                            <EyeIcon className="size-2.5 mr-0.5" />
                          ) : (
                            <EyeOffIcon className="size-2.5 mr-0.5" />
                          )}
                          {project.is_public ? "Public" : "Private"}
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
                    <ImageIcon className="size-8 text-muted-foreground/50" />
                    <h2 className="truncate text-sm font-bold uppercase tracking-wider text-muted-foreground/70">
                      {getArchProjectTitle(project)}
                    </h2>
                    <p className="truncate text-xs text-muted-foreground/60">
                      {project.client.name}
                      {project.location ? ` · ${project.location}` : ""}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed bg-secondary/30 px-6 py-12 text-center">
            <div className="space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-background text-muted-foreground">
                <Building2Icon className="size-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">No projects found</h2>
                <p className="text-sm text-muted-foreground">
                  Create a project or adjust the current filter.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

