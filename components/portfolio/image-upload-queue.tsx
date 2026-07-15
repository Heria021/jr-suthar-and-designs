"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ImagePlusIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type QueuedPortfolioImage = {
  id: string
  file: File
  previewUrl: string
}

export function ImageUploadQueue({
  inputName,
  disabled,
  variant = "default",
  onChange,
}: {
  inputName?: string
  disabled?: boolean
  variant?: "default" | "media-grid"
  onChange: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueuedPortfolioImage[]>([])
  const [queue, setQueue] = useState<QueuedPortfolioImage[]>([])
  const [sequencedIds, setSequencedIds] = useState<string[]>([])

  const orderedQueue = useMemo(() => {
    const sequenced = sequencedIds
      .map((id) => queue.find((item) => item.id === id))
      .filter((item): item is QueuedPortfolioImage => Boolean(item))
    const remaining = queue.filter((item) => !sequencedIds.includes(item.id))

    return [...sequenced, ...remaining]
  }, [queue, sequencedIds])

  const files = useMemo(() => orderedQueue.map((item) => item.file), [orderedQueue])

  useEffect(() => {
    onChange(files)
  }, [files, onChange])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  function appendFiles(fileList: FileList | null) {
    if (!fileList) {
      return
    }

    const nextItems = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))

    setQueue((current) => [...current, ...nextItems])

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  function addToSequence(id: string) {
    setSequencedIds((current) => {
      if (!queue.some((item) => item.id === id)) {
        return current
      }

      return [...current.filter((itemId) => itemId !== id), id]
    })
  }

  function removeItem(id: string) {
    setQueue((current) => {
      const selected = current.find((item) => item.id === id)
      if (selected) {
        URL.revokeObjectURL(selected.previewUrl)
      }

      return current.filter((item) => item.id !== id)
    })
    setSequencedIds((currentIds) => currentIds.filter((itemId) => itemId !== id))
  }

  return (
    <div className="space-y-4">
      <Input
        ref={inputRef}
        name={inputName}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        disabled={disabled}
        onChange={(event) => appendFiles(event.target.files)}
        className="sr-only"
      />

      {variant === "media-grid" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-secondary/30 px-6 py-8 text-center transition-colors hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-60"
          >
            <ImagePlusIcon className="size-6 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Choose project images</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP, or AVIF.
              </p>
            </div>
          </button>
          {orderedQueue.map((item, index) => {
            const isSequenced = sequencedIds.includes(item.id)

            return (
              <PendingMediaCard
                key={item.id}
                item={item}
                index={index}
                disabled={disabled}
                isSequenced={isSequenced}
                onSelect={() => addToSequence(item.id)}
                onRemove={() => removeItem(item.id)}
              />
            )
          })}
        </div>
      ) : (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-secondary/30 px-6 py-8 text-center transition-colors hover:bg-secondary/50 disabled:pointer-events-none disabled:opacity-60",
              queue.length > 0 && "min-h-28"
            )}
          >
            <ImagePlusIcon className="size-6 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Choose project images</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP, or AVIF.
              </p>
            </div>
          </button>

          {queue.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orderedQueue.map((item, index) => {
            const isSequenced = sequencedIds.includes(item.id)

            return (
              <div
                key={item.id}
                className={cn(
                  "group overflow-hidden rounded-lg border bg-background",
                  isSequenced && "border-primary/50"
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addToSequence(item.id)}
                  className="relative aspect-[4/3] w-full overflow-hidden bg-secondary text-left disabled:pointer-events-none"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="absolute top-2 left-2 rounded-md bg-background/95 px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
                    {index === 0 ? "Cover" : `#${index + 1}`}
                  </span>
                  {isSequenced ? (
                    <span className="absolute right-2 bottom-2 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                      Selected
                    </span>
                  ) : null}
                </button>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">
                      {item.file.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    onClick={() => removeItem(item.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function PendingMediaCard({
  item,
  index,
  disabled,
  isSequenced,
  onSelect,
  onRemove,
}: {
  item: QueuedPortfolioImage
  index: number
  disabled?: boolean
  isSequenced: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-dashed bg-background transition-all duration-300 hover:border-foreground/20 hover:shadow-md",
        isSequenced && "border-primary/50"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="relative aspect-video w-full overflow-hidden border-b bg-secondary text-left disabled:pointer-events-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewUrl}
          alt={item.file.name}
          className="h-full w-full object-cover opacity-80 grayscale-[15%] transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-amber-500/10 ring-1 ring-inset ring-amber-500/25" />
        <span className="absolute top-3 right-3 rounded border-none bg-amber-500 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-white uppercase shadow-sm">
          Not uploaded
        </span>
        <span className="absolute top-3 left-3 rounded-md bg-background/95 px-2 py-1 text-xs font-semibold text-foreground shadow-sm">
          {index === 0 ? "Cover" : `#${index + 1}`}
        </span>
        <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="rounded-md bg-white px-2.5 py-1 text-[10px] font-semibold text-black">
            Waiting for upload
          </span>
        </div>
      </button>
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{item.file.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {(item.file.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
