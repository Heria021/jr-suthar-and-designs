"use client"

import {
  createArchProjectMediaAction,
  type ArchActionResult,
  type ArchProjectMediaPayload,
} from "@/app/(app)/jr-suthar-and-designs/actions"
import { ARCH_PROJECT_MEDIA_BUCKET } from "@/lib/portfolio/constants"
import { createClient } from "@/lib/supabase/client"

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
])

function safeFileName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "project-image"
  )
}

function uploadPath(projectId: string, file: File) {
  return `${projectId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
}

function uploadError<T = never>(message: string): ArchActionResult<T> {
  return { ok: false, error: message }
}

export async function uploadArchProjectMediaFromBrowser(
  projectId: string,
  file: File,
  payload: Omit<ArchProjectMediaPayload, "file_path">
) {
  if (file.size === 0) {
    return uploadError("Choose an image to upload.")
  }

  if (!imageMimeTypes.has(file.type)) {
    return uploadError("Only JPG, PNG, WebP, or AVIF images are supported.")
  }

  const supabase = createClient()
  const filePath = uploadPath(projectId, file)
  const { error: uploadStorageError } = await supabase.storage
    .from(ARCH_PROJECT_MEDIA_BUCKET)
    .upload(filePath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    })

  if (uploadStorageError) {
    return uploadError(uploadStorageError.message)
  }

  const result = await createArchProjectMediaAction(projectId, {
    ...payload,
    file_path: filePath,
  })

  if (!result.ok) {
    await supabase.storage.from(ARCH_PROJECT_MEDIA_BUCKET).remove([filePath])
  }

  return result
}
