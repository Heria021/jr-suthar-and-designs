"use server"

import { revalidatePath } from "next/cache"

import { ARCH_PROJECT_MEDIA_BUCKET } from "@/lib/portfolio/constants"
import type { ArchProjectMedia } from "@/lib/portfolio/types"
import { createClient } from "@/lib/supabase/server"

export type ArchActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type ArchClientPayload = {
  name: string
  phone: string | null
}

export type ArchProjectPayload = {
  client_id: string
  project_type:
    | "residential"
    | "commercial"
    | "interior"
    | "renovation"
    | "visualization"
    | "other"
  location: string | null
  description: string | null
  is_public: boolean
  is_featured: boolean
  slug: string | null
  sort_order: number
  public_title: string | null
  public_description: string | null
}

export type ArchProjectMediaPayload = {
  file_path: string
  caption: string | null
  phase: "before" | "during" | "after" | null
  is_public: boolean
  is_cover: boolean
  sort_order: number
}

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
])

function idempotencyKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function actionError<T = never>(error: unknown): ArchActionResult<T> {
  return {
    ok: false,
    error:
      error instanceof Error ? error.message : "Something went wrong. Try again.",
  }
}

async function rpc<T>(
  name: string,
  args: Record<string, unknown>
): Promise<ArchActionResult<T>> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc(name, args)

    if (error) {
      throw new Error(error.message)
    }

    revalidatePath("/jr-suthar-and-designs")
    return { ok: true, data: data as T }
  } catch (error) {
    return actionError(error)
  }
}

function nullableString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function booleanValue(value: FormDataEntryValue | null) {
  return value === "true" || value === "on"
}

function numberValue(value: FormDataEntryValue | null, fallback = 0) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function uploadPath(projectId: string, file: File) {
  const originalName = file.name || "project-image"
  const safeName = originalName
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)

  return `${projectId}/${crypto.randomUUID()}-${safeName || "project-image"}`
}

export async function createArchClientAction(payload: ArchClientPayload) {
  return rpc<{ id: string }>("create_arch_client", {
    p_idempotency_key: idempotencyKey("create-arch-client"),
    p_payload: payload,
  })
}

export async function updateArchClientAction(
  clientId: string,
  payload: Partial<ArchClientPayload>
) {
  return rpc<{ id: string }>("update_arch_client", {
    p_idempotency_key: idempotencyKey("update-arch-client"),
    p_client_id: clientId,
    p_payload: payload,
  })
}

export async function deleteArchClientAction(clientId: string) {
  return rpc<{ id: string }>("delete_arch_client", {
    p_idempotency_key: idempotencyKey("delete-arch-client"),
    p_client_id: clientId,
  })
}

export async function createArchProjectAction(payload: ArchProjectPayload) {
  return rpc<{ id: string }>("create_arch_project", {
    p_idempotency_key: idempotencyKey("create-arch-project"),
    p_payload: payload,
  })
}

export async function updateArchProjectAction(
  projectId: string,
  payload: Partial<ArchProjectPayload>
) {
  return rpc<{ id: string }>("update_arch_project", {
    p_idempotency_key: idempotencyKey("update-arch-project"),
    p_project_id: projectId,
    p_payload: payload,
  })
}

export async function deleteArchProjectAction(projectId: string) {
  const result = await rpc<{ id: string; file_paths?: string[] }>(
    "delete_arch_project",
    {
      p_idempotency_key: idempotencyKey("delete-arch-project"),
      p_project_id: projectId,
    }
  )

  if (result.ok && result.data.file_paths?.length) {
    const supabase = await createClient()
    await supabase.storage
      .from(ARCH_PROJECT_MEDIA_BUCKET)
      .remove(result.data.file_paths)
  }

  return result
}

export async function createArchProjectMediaAction(
  projectId: string,
  payload: ArchProjectMediaPayload
) {
  const result = await rpc<{ id: string }>("create_arch_project_media", {
    p_idempotency_key: idempotencyKey("create-arch-media"),
    p_project_id: projectId,
    p_payload: payload,
  })

  if (!result.ok) {
    return result
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("arch_project_media")
      .select("id,project_id,file_path,caption,phase,is_public,is_cover,sort_order,created_at")
      .eq("id", result.data.id)
      .single<Omit<ArchProjectMedia, "signed_url">>()

    if (error) {
      throw new Error(error.message)
    }

    const { data: signedUrlData } = await supabase.storage
      .from(ARCH_PROJECT_MEDIA_BUCKET)
      .createSignedUrl(data.file_path, 60 * 60)

    return {
      ok: true,
      data: {
        ...data,
        signed_url: signedUrlData?.signedUrl ?? null,
      },
    } satisfies ArchActionResult<ArchProjectMedia>
  } catch (error) {
    return actionError(error)
  }
}

export async function uploadArchProjectMediaAction(
  projectId: string,
  formData: FormData
) {
  try {
    const file = formData.get("file")

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose an image to upload.")
    }

    if (!imageMimeTypes.has(file.type)) {
      throw new Error("Only JPG, PNG, WebP, or AVIF images are supported.")
    }

    const supabase = await createClient()
    const filePath = uploadPath(projectId, file)
    const { error: uploadError } = await supabase.storage
      .from(ARCH_PROJECT_MEDIA_BUCKET)
      .upload(filePath, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const result = await createArchProjectMediaAction(projectId, {
      file_path: filePath,
      caption: nullableString(formData.get("caption")),
      phase: nullableString(formData.get("phase")) as
        | ArchProjectMediaPayload["phase"]
        | null,
      is_public: booleanValue(formData.get("is_public")),
      is_cover: booleanValue(formData.get("is_cover")),
      sort_order: numberValue(formData.get("sort_order")),
    })

    if (!result.ok) {
      await supabase.storage.from(ARCH_PROJECT_MEDIA_BUCKET).remove([filePath])
    }

    return result
  } catch (error) {
    return actionError(error)
  }
}

export async function updateArchProjectMediaAction(
  mediaId: string,
  payload: Partial<Omit<ArchProjectMediaPayload, "file_path">>
) {
  return rpc<{ id: string }>("update_arch_project_media", {
    p_idempotency_key: idempotencyKey("update-arch-media"),
    p_media_id: mediaId,
    p_payload: payload,
  })
}

export async function deleteArchProjectMediaAction(mediaId: string) {
  const result = await rpc<{ id: string; file_path?: string }>(
    "delete_arch_project_media",
    {
      p_idempotency_key: idempotencyKey("delete-arch-media"),
      p_media_id: mediaId,
    }
  )

  if (result.ok && result.data.file_path) {
    const supabase = await createClient()
    await supabase.storage
      .from(ARCH_PROJECT_MEDIA_BUCKET)
      .remove([result.data.file_path])
  }

  return result
}

export async function reorderArchProjectMediaAction(
  projectId: string,
  mediaIds: string[]
) {
  return rpc<{ id: string }>("reorder_arch_project_media", {
    p_idempotency_key: idempotencyKey("reorder-arch-media"),
    p_project_id: projectId,
    p_media_ids: mediaIds,
  })
}
