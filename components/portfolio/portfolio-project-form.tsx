"use client"

import { FormEvent, useMemo, useState } from "react"

import type { ArchClient, ArchProject } from "@/lib/portfolio/types"
import { ARCH_PROJECT_TYPES, projectTypeLabels } from "@/lib/portfolio/types"
import type { ArchProjectPayload } from "@/app/(app)/jr-suthar-and-designs/actions"
import { ImageUploadQueue } from "@/components/portfolio/image-upload-queue"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

export type PortfolioProjectSubmit = {
  client: {
    id?: string
    name: string
    phone: string | null
  }
  project: ArchProjectPayload
  files: File[]
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function generatedSlug(project: ArchProject | undefined, titleSeed: string) {
  if (project?.slug) {
    return project.slug
  }

  const base = slugify(titleSeed) || "project"
  return `${base}-${crypto.randomUUID().slice(0, 8)}`
}

function initialValues(project?: ArchProject) {
  return {
    clientName: project?.client.name ?? "",
    clientPhone: project?.client.phone ?? "",
    projectType: project?.project_type ?? "residential",
    location: project?.location ?? "",
    isPublic: project?.is_public ?? false,
    isFeatured: project?.is_featured ?? false,
    projectTitle: project?.public_title ?? project?.description ?? "",
    projectDescription: project?.public_description ?? "",
  }
}

export function PortfolioProjectForm({
  mode,
  clients,
  project,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: "create" | "edit"
  clients: ArchClient[]
  project?: ArchProject
  pending: boolean
  onSubmit: (payload: PortfolioProjectSubmit) => void
  onCancel?: () => void
}) {
  const defaults = useMemo(() => initialValues(project), [project])
  const [clientName, setClientName] = useState(defaults.clientName)
  const [clientPhone, setClientPhone] = useState(defaults.clientPhone)
  const [projectType, setProjectType] = useState(defaults.projectType)
  const [location, setLocation] = useState(defaults.location)
  const [isPublic, setIsPublic] = useState(defaults.isPublic)
  const [isFeatured, setIsFeatured] = useState(defaults.isFeatured)
  const [projectTitle, setProjectTitle] = useState(defaults.projectTitle)
  const [projectDescription, setProjectDescription] = useState(
    defaults.projectDescription
  )
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const matchedClient = useMemo(() => {
    const normalized = clientName.trim().toLowerCase()
    return clients.find((client) => client.name.toLowerCase() === normalized)
  }, [clientName, clients])

  function updateClientName(value: string) {
    setClientName(value)
    const match = clients.find(
      (client) => client.name.toLowerCase() === value.trim().toLowerCase()
    )

    if (match) {
      setClientPhone(match.phone ?? "")
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedClientName = clientName.trim()
    if (!trimmedClientName) {
      return
    }

    const titleSeed =
      projectTitle || projectDescription.split("\n")[0] || location || projectType
    const finalSlug = isPublic ? generatedSlug(project, titleSeed) : project?.slug

    onSubmit({
      client: {
        id: project?.client_id ?? matchedClient?.id,
        name: trimmedClientName,
        phone: clientPhone.trim() || null,
      },
      project: {
        client_id: project?.client_id ?? matchedClient?.id ?? "",
        project_type: projectType,
        location: location.trim() || null,
        description: null,
        is_public: isPublic,
        is_featured: isFeatured,
        slug: finalSlug || null,
        sort_order: project?.sort_order ?? 0,
        public_title: projectTitle.trim() || null,
        public_description: projectDescription.trim() || null,
      },
      files: selectedFiles,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Client</h2>
          <p className="text-xs text-muted-foreground">
            Type an existing client name to reuse it, or enter a new one.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="arch-client-name">Client name</Label>
            <Input
              id="arch-client-name"
              list="arch-clients"
              value={clientName}
              onChange={(event) => updateClientName(event.target.value)}
              placeholder="Ramesh Sharma"
              required
              className="bg-secondary/50 shadow-none"
            />
            <datalist id="arch-clients">
              {clients.map((client) => (
                <option key={client.id} value={client.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arch-client-phone">Phone</Label>
            <Input
              id="arch-client-phone"
              value={clientPhone}
              onChange={(event) => setClientPhone(event.target.value)}
              placeholder="98290xxxxx"
              className="bg-secondary/50 shadow-none"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Project</h2>
          <p className="text-xs text-muted-foreground">
            Project details used internally and on the public portfolio.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="arch-project-title">Project title</Label>
            <Input
              id="arch-project-title"
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
              placeholder="Courtyard House"
              className="bg-secondary/50 shadow-none"
            />
          </div>
          <div className="space-y-2">
            <Label>Project type</Label>
            <Select
              value={projectType}
              onValueChange={(value) =>
                setProjectType(value as typeof projectType)
              }
            >
              <SelectTrigger className="w-full bg-secondary/50 shadow-none">
                <SelectValue placeholder="Project type" />
              </SelectTrigger>
              <SelectContent>
                {ARCH_PROJECT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {projectTypeLabels[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="arch-project-location">Location</Label>
            <Input
              id="arch-project-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Jaipur"
              className="bg-secondary/50 shadow-none"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="arch-project-description">Project description</Label>
            <Textarea
              id="arch-project-description"
              value={projectDescription}
              onChange={(event) => setProjectDescription(event.target.value)}
              placeholder="A light-filled residence shaped around a central courtyard."
              className="min-h-24 bg-secondary/50 shadow-none"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-secondary/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Public portfolio
            </h2>
            <p className="text-xs text-muted-foreground">
              Published projects can be used on the future landing page.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              Public
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              Featured
            </label>
          </div>
        </div>
      </section>

      {mode === "create" ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">Images</h2>
            <p className="text-xs text-muted-foreground">
              The first image in the selected sequence becomes the cover.
            </p>
          </div>
          <ImageUploadQueue disabled={pending} onChange={setSelectedFiles} />
        </section>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t pt-6">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            className="shadow-none"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {mode === "create" ? "Create Project" : "Save Changes"}
        </Button>
      </div>
    </form>
  )
}
