import { ARCH_PROJECT_MEDIA_BUCKET } from "@/lib/portfolio/constants"
import { createClient } from "@/lib/supabase/server"

import type {
  ArchClient,
  ArchMediaPhase,
  ArchProject,
  ArchProjectMedia,
  ArchProjectType,
} from "./types"

type RawArchMedia = Omit<ArchProjectMedia, "signed_url"> & {
  phase: ArchMediaPhase | null
}

type RawArchProject = Omit<ArchProject, "client" | "media" | "cover"> & {
  client: ArchClient | ArchClient[] | null
  media: RawArchMedia[] | null
}

function normalizeClient(value: RawArchProject["client"], clientId: string) {
  const client = Array.isArray(value) ? value[0] : value

  return (
    client ?? {
      id: clientId,
      name: "Unknown client",
      phone: null,
    }
  )
}

function sortMedia(media: ArchProjectMedia[]) {
  return [...media].sort((a, b) => {
    if (a.is_cover !== b.is_cover) {
      return a.is_cover ? -1 : 1
    }

    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

async function signedUrlMap(paths: string[]) {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)))

  if (uniquePaths.length === 0) {
    return new Map<string, string>()
  }

  const supabase = await createClient()
  const { data } = await supabase.storage
    .from(ARCH_PROJECT_MEDIA_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60)

  return new Map(
    uniquePaths.map((path, index) => [path, data?.[index]?.signedUrl ?? ""])
  )
}

async function normalizeProjects(projects: RawArchProject[]) {
  const urlMap = await signedUrlMap(
    projects.flatMap((project) => project.media?.map((item) => item.file_path) ?? [])
  )

  return projects.map((project): ArchProject => {
    const media = sortMedia(
      (project.media ?? []).map((item) => ({
        ...item,
        signed_url: urlMap.get(item.file_path) || null,
      }))
    )

    return {
      ...project,
      client: normalizeClient(project.client, project.client_id),
      media,
      cover: media.find((item) => item.is_cover) ?? media[0] ?? null,
    }
  })
}

export async function getArchClients() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("arch_clients")
    .select("id,name,phone,created_at,updated_at")
    .order("name", { ascending: true })
    .returns<ArchClient[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function getArchProjects() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("arch_projects")
    .select(
      "id,client_id,project_type,location,description,is_public,is_featured,slug,sort_order,public_title,public_description,created_at,updated_at,client:arch_clients(id,name,phone),media:arch_project_media(id,project_id,file_path,caption,phase,is_public,is_cover,sort_order,created_at)"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<RawArchProject[]>()

  if (error) {
    throw new Error(error.message)
  }

  return normalizeProjects(data ?? [])
}

export async function getArchProject(projectId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("arch_projects")
    .select(
      "id,client_id,project_type,location,description,is_public,is_featured,slug,sort_order,public_title,public_description,created_at,updated_at,client:arch_clients(id,name,phone),media:arch_project_media(id,project_id,file_path,caption,phase,is_public,is_cover,sort_order,created_at)"
    )
    .eq("id", projectId)
    .maybeSingle<RawArchProject>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const [project] = await normalizeProjects([data])
  return project
}

export type ArchProjectFormDefaults = {
  client_id?: string
  client_name: string
  client_phone: string
  project_type: ArchProjectType
  location: string
  description: string
  is_public: boolean
  is_featured: boolean
  sort_order: number
  public_title: string
  public_description: string
}
