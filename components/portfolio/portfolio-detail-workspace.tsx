"use client"

import { useRouter } from "next/navigation"
import type { ChangeEvent } from "react"
import { useEffect, useRef, useState, useTransition } from "react"
import {
  ImageIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  deleteArchProjectAction,
  deleteArchProjectMediaAction,
  updateArchClientAction,
  updateArchProjectAction,
  updateArchProjectMediaAction,
} from "@/app/(app)/jr-suthar-and-designs/actions"
import { PortfolioProjectForm } from "@/components/portfolio/portfolio-project-form"
import type { PortfolioProjectSubmit } from "@/components/portfolio/portfolio-project-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ArchClient, ArchProject, ArchProjectMedia } from "@/lib/portfolio/types"
import {
  getArchProjectTitle,
  projectTypeLabels,
} from "@/lib/portfolio/types"
import { uploadArchProjectMediaFromBrowser } from "@/lib/portfolio/upload-client"

type PendingUpload = {
  id: string
  file: File
  previewUrl: string
}

function sortProjectMedia(media: ArchProjectMedia[]) {
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

export function PortfolioDetailWorkspace({
  project,
  clients,
}: {
  project: ArchProject
  clients: ArchClient[]
}) {
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState(project)
  const [isEditing, setIsEditing] = useState(false)
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadsRef = useRef<PendingUpload[]>([])

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads
  }, [pendingUploads])

  useEffect(() => {
    return () => {
      pendingUploadsRef.current.forEach((item) =>
        URL.revokeObjectURL(item.previewUrl)
      )
    }
  }, [])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setPendingUploads((current) => [...current, ...files])
    // reset input so the same files can be re-added if needed
    event.target.value = ""
  }

  function removePendingUpload(uploadId: string) {
    setPendingUploads((current) => {
      const selected = current.find((item) => item.id === uploadId)
      if (selected) {
        URL.revokeObjectURL(selected.previewUrl)
      }

      return current.filter((item) => item.id !== uploadId)
    })
  }

  function refresh() {
    router.refresh()
  }

  function update(payload: PortfolioProjectSubmit) {
    startTransition(async () => {
      const toastId = toast.loading("Saving project...")

      const [clientResult, projectResult] = await Promise.all([
        updateArchClientAction(currentProject.client_id, {
          name: payload.client.name,
          phone: payload.client.phone,
        }),
        updateArchProjectAction(currentProject.id, {
          ...payload.project,
          client_id: currentProject.client_id,
        }),
      ])

      if (!clientResult.ok) {
        toast.error(clientResult.error, { id: toastId })
        return
      }

      if (!projectResult.ok) {
        toast.error(projectResult.error, { id: toastId })
        return
      }

      setCurrentProject((entry) => ({
        ...entry,
        client: {
          ...entry.client,
          name: payload.client.name,
          phone: payload.client.phone,
        },
        project_type: payload.project.project_type,
        location: payload.project.location,
        description: null,
        is_public: payload.project.is_public,
        is_featured: payload.project.is_featured,
        slug: payload.project.slug,
        sort_order: payload.project.sort_order,
        public_title: payload.project.public_title,
        public_description: payload.project.public_description,
      }))
      setIsEditing(false)
      toast.success("Project saved", { id: toastId })
      refresh()
    })
  }

  function deleteProject() {
    startTransition(async () => {
      const toastId = toast.loading("Deleting project...")
      const result = await deleteArchProjectAction(currentProject.id)

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      toast.success("Project deleted", { id: toastId })
      router.push("/jr-suthar-and-designs")
      router.refresh()
    })
  }

  function uploadImages() {
    if (pendingUploads.length === 0) {
      toast.error("Choose at least one image.")
      return
    }

    startTransition(async () => {
      const toastId = toast.loading("Uploading images...")
      let failures = 0
      const uploadedMedia: ArchProjectMedia[] = []

      for (const [index, item] of pendingUploads.entries()) {
        const result = await uploadArchProjectMediaFromBrowser(
          currentProject.id,
          item.file,
          {
            caption: null,
            phase: null,
            is_public: currentProject.is_public,
            is_cover: index === 0,
            sort_order: currentProject.media.length + index,
          }
        )
        if (!result.ok) {
          failures += 1
        } else {
          uploadedMedia.push(result.data)
        }
      }

      if (failures > 0) {
        toast.warning(
          `${pendingUploads.length - failures} uploaded, ${failures} failed.`,
          { id: toastId }
        )
      } else {
        toast.success("Images uploaded", { id: toastId })
      }

      setPendingUploads((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
        return []
      })
      if (uploadedMedia.length > 0) {
        setCurrentProject((entry) => {
          const hasNewCover = uploadedMedia.some((item) => item.is_cover)
          const existingMedia = hasNewCover
            ? entry.media.map((item) => ({ ...item, is_cover: false }))
            : entry.media
          const media = sortProjectMedia([...existingMedia, ...uploadedMedia])

          return {
            ...entry,
            media,
            cover: media.find((item) => item.is_cover) ?? media[0] ?? null,
          }
        })
      }
      refresh()
    })
  }

  function updateMedia(mediaId: string, payload: Partial<ArchProjectMedia>) {
    startTransition(async () => {
      const toastId = toast.loading("Saving image...")
      const result = await updateArchProjectMediaAction(mediaId, {
        caption: null,
        phase: null,
        is_public: payload.is_public,
        is_cover: payload.is_cover,
        sort_order: payload.sort_order,
      })

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      setCurrentProject((entry) => {
        const media = sortProjectMedia(
          entry.media.map((item) => {
            if (item.id !== mediaId) {
              return payload.is_cover ? { ...item, is_cover: false } : item
            }

            return { ...item, ...payload }
          })
        )

        return {
          ...entry,
          media,
          cover: media.find((item) => item.is_cover) ?? media[0] ?? null,
        }
      })
      toast.success("Image saved", { id: toastId })
      refresh()
    })
  }

  function deleteMedia(mediaId: string) {
    startTransition(async () => {
      const toastId = toast.loading("Deleting image...")
      const result = await deleteArchProjectMediaAction(mediaId)

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      setCurrentProject((entry) => {
        const media = entry.media.filter((item) => item.id !== mediaId)
        return {
          ...entry,
          media,
          cover: media.find((item) => item.is_cover) ?? media[0] ?? null,
        }
      })
      toast.success("Image deleted", { id: toastId })
      refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-8">
      {isEditing && (
        <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              Edit Project
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="shadow-none"
              onClick={() => setIsEditing(false)}
            >
              Close Edit
            </Button>
          </div>
        </div>
      )}

      {isEditing ? (
        <PortfolioProjectForm
          mode="edit"
          clients={clients}
          project={currentProject}
          pending={isPending}
          onSubmit={update}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full h-auto">
            {/* Left: Cover Image */}
            <div className="flex-[1.2] relative overflow-hidden rounded-xl border bg-secondary/30 min-h-[350px] lg:min-h-[450px]">
              {currentProject.cover?.signed_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentProject.cover.signed_url}
                    alt={getArchProjectTitle(currentProject)}
                    className="h-full w-full object-cover absolute inset-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-white space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="rounded-md bg-white/20 text-white border-none hover:bg-white/30 backdrop-blur-xs">
                        {projectTypeLabels[currentProject.project_type]}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="rounded-md bg-white/20 text-white border-none hover:bg-white/30 backdrop-blur-xs"
                      >
                        {currentProject.is_public ? "Public" : "Private"}
                      </Badge>
                      {currentProject.is_featured ? (
                        <Badge variant="default" className="rounded-md">
                          Featured
                        </Badge>
                      ) : null}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold uppercase tracking-wider">
                      {getArchProjectTitle(currentProject)}
                    </h1>
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full min-h-[350px] items-center justify-center text-muted-foreground p-6">
                  <div className="text-center space-y-2">
                    <ImageIcon className="mx-auto size-12 text-muted-foreground/60" />
                    <h1 className="text-xl font-bold uppercase tracking-wider text-muted-foreground/80">
                      {getArchProjectTitle(currentProject)}
                    </h1>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Details (No outline, no card background) */}
            <div className="flex-[1] flex flex-col justify-between py-2 space-y-6">
              {/* Client Details Section */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                  Client Details
                </h2>
                <div className="space-y-1">
                  <InfoRow label="Client" value={currentProject.client.name} />
                  <InfoRow label="Phone" value={currentProject.client.phone || "-"} />
                  <InfoRow label="Location" value={currentProject.location || "-"} />
                </div>
              </div>
              <div className="space-y-3">
                {/* Project Description Section */}
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
                    Project Description
                  </h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                    {currentProject.public_description || "No description provided."}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-border/40 flex gap-2 justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shadow-none"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
                      <Trash2Icon className="size-4" />
                      Delete
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This removes the project, media records, and uploaded project
                          images from storage.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={deleteProject}
                          disabled={isPending}
                        >
                          Delete Project
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">
                  Project images
                </h2>
                <p className="text-xs text-muted-foreground">
                  Manage public visibility and cover image.
                </p>
              </div>
              {pendingUploads.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="rounded-md text-xs">
                    {pendingUploads.length} file{pendingUploads.length === 1 ? "" : "s"} ready
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={uploadImages}
                  >
                    Upload
                  </Button>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              disabled={isPending}
              onChange={handleFileChange}
              className="sr-only"
            />

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
              {currentProject.media.map((media) => (
                <MediaEditor
                  key={media.id}
                  media={media}
                  pending={isPending}
                  onMakeCover={() =>
                    updateMedia(media.id, {
                      is_public: media.is_public,
                      is_cover: true,
                      sort_order: media.sort_order,
                    })
                  }
                  onDelete={() => deleteMedia(media.id)}
                />
              ))}

              {pendingUploads.map((item, index) => (
                <PendingUploadCard
                  key={item.id}
                  item={item}
                  index={index}
                  disabled={isPending}
                  onRemove={() => removePendingUpload(item.id)}
                />
              ))}

              {/* Upload card - last grid item */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-border/60 bg-secondary/20 text-muted-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-secondary/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <ImageIcon className="size-7 transition-transform duration-200 group-hover:scale-110" />
                <span className="text-xs font-medium">Add images</span>
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t pt-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function MediaEditor({
  media,
  pending,
  onMakeCover,
  onDelete,
}: {
  media: ArchProjectMedia
  pending: boolean
  onMakeCover: () => void
  onDelete: () => void
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-background transition-all duration-300 hover:border-foreground/20 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden border-b bg-secondary">
        {media.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.signed_url}
            alt="Project image"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageIcon className="size-8" />
          </div>
        )}
        {media.is_cover ? (
          <Badge className="absolute top-3 right-3 rounded border-none bg-amber-500 py-0.5 text-[9px] font-semibold tracking-wider text-white uppercase hover:bg-amber-500">
            Cover
          </Badge>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {!media.is_cover ? (
            <Button
              type="button"
              onClick={onMakeCover}
              disabled={pending}
              size="sm"
              className="h-7 rounded-md bg-white px-2.5 text-[10px] font-semibold text-black hover:bg-white/90"
            >
              Make cover
            </Button>
          ) : null}
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  className="size-7 rounded-md"
                  disabled={pending}
                />
              }
            >
              <Trash2Icon className="size-3.5" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete image?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the media record and the uploaded file from
                  storage.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={onDelete}
                  disabled={pending}
                >
                  Delete Image
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}

function PendingUploadCard({
  item,
  index,
  disabled,
  onRemove,
}: {
  item: PendingUpload
  index: number
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-dashed border-amber-500/55 bg-background transition-all duration-300 hover:border-amber-500/80 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden border-b bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="h-full w-full object-cover opacity-80 grayscale-[15%] transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-amber-500/10 ring-1 ring-inset ring-amber-500/25" />
        <Badge className="absolute top-3 right-3 rounded border-none bg-amber-500 py-0.5 text-[9px] font-semibold tracking-wider text-white uppercase hover:bg-amber-500">
          Not uploaded
        </Badge>
        <span className="absolute top-3 left-3 rounded-md bg-background/95 px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
          {index === 0 ? "Cover" : `#${index + 1}`}
        </span>
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-black">
            Waiting for upload
          </span>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            className="size-7 rounded-md"
            disabled={disabled}
            onClick={onRemove}
          >
            <Trash2Icon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
