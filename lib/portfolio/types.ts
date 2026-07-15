export const ARCH_PROJECT_TYPES = [
  "residential",
  "commercial",
  "interior",
  "renovation",
  "visualization",
  "other",
] as const

export const ARCH_MEDIA_PHASES = ["before", "during", "after"] as const

export type ArchProjectType = (typeof ARCH_PROJECT_TYPES)[number]
export type ArchMediaPhase = (typeof ARCH_MEDIA_PHASES)[number]

export type ArchClient = {
  id: string
  name: string
  phone: string | null
  created_at?: string
  updated_at?: string
}

export type ArchProjectMedia = {
  id: string
  project_id: string
  file_path: string
  signed_url: string | null
  caption: string | null
  phase: ArchMediaPhase | null
  is_public: boolean
  is_cover: boolean
  sort_order: number
  created_at: string
}

export type ArchProject = {
  id: string
  client_id: string
  client: ArchClient
  project_type: ArchProjectType
  location: string | null
  description: string | null
  is_public: boolean
  is_featured: boolean
  slug: string | null
  sort_order: number
  public_title: string | null
  public_description: string | null
  created_at: string
  updated_at: string
  media: ArchProjectMedia[]
  cover: ArchProjectMedia | null
}

export const projectTypeLabels: Record<ArchProjectType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  interior: "Interior",
  renovation: "Renovation",
  visualization: "Visualization",
  other: "Other",
}

export function getArchProjectTitle(project: Pick<ArchProject, "public_title" | "description" | "location" | "project_type">) {
  return (
    project.public_title ||
    project.description ||
    [projectTypeLabels[project.project_type], project.location]
      .filter(Boolean)
      .join(" - ")
  )
}
