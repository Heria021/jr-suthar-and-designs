import { ARCH_PROJECT_MEDIA_BUCKET } from "@/lib/portfolio/constants"
import { createClient } from "@/lib/supabase/server"

import type { ArchProjectType } from "./types"

type RawPublicMedia = {
  id: string
  project_id: string
  file_path: string
  is_cover: boolean
  sort_order: number
  created_at: string
}

type RawPublicProject = {
  id: string
  slug: string | null
  project_type: ArchProjectType
  location: string | null
  public_title: string | null
  public_description: string | null
  is_featured: boolean
  sort_order: number
  created_at: string
  media: RawPublicMedia[] | null
}

export type PublicPortfolioMedia = RawPublicMedia & {
  signed_url: string | null
}

export type PublicPortfolioProject = Omit<RawPublicProject, "media"> & {
  media: PublicPortfolioMedia[]
  cover: PublicPortfolioMedia | null
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

function sortMedia(media: PublicPortfolioMedia[]) {
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

async function normalizePublicProjects(projects: RawPublicProject[]) {
  const urlMap = await signedUrlMap(
    projects.flatMap((project) => project.media?.map((item) => item.file_path) ?? [])
  )

  return projects.map((project): PublicPortfolioProject => {
    const media = sortMedia(
      (project.media ?? [])
        .filter((item) => item.file_path)
        .map((item) => ({
          ...item,
          signed_url: urlMap.get(item.file_path) || null,
        }))
    )

    return {
      ...project,
      media,
      cover: media.find((item) => item.is_cover) ?? media[0] ?? null,
    }
  })
}

export async function getPublicPortfolioProjects() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("arch_projects")
    .select(
      "id,slug,project_type,location,public_title,public_description,is_featured,sort_order,created_at,media:arch_project_media(id,project_id,file_path,is_cover,sort_order,created_at)"
    )
    .eq("is_public", true)
    .eq("media.is_public", true)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<RawPublicProject[]>()

  if (error) {
    throw new Error(error.message)
  }

  return normalizePublicProjects(data ?? [])
}

export async function getPublicPortfolioProject(identifier: string) {
  const supabase = await createClient()
  const query = supabase
    .from("arch_projects")
    .select(
      "id,slug,project_type,location,public_title,public_description,is_featured,sort_order,created_at,media:arch_project_media(id,project_id,file_path,is_cover,sort_order,created_at)"
    )
    .eq("is_public", true)
    .eq("media.is_public", true)

  const { data, error } = await (isUuid(identifier)
    ? query.eq("id", identifier)
    : query.eq("slug", identifier)
  ).maybeSingle<RawPublicProject>()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    return null
  }

  const [project] = await normalizePublicProjects([data])
  return project
}
