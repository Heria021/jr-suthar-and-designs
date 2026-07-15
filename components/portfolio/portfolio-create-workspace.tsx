"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import {
  createArchClientAction,
  createArchProjectAction,
} from "@/app/(app)/jr-suthar-and-designs/actions"
import { PortfolioProjectForm } from "@/components/portfolio/portfolio-project-form"
import type { PortfolioProjectSubmit } from "@/components/portfolio/portfolio-project-form"
import { buttonVariants } from "@/components/ui/button"
import { uploadArchProjectMediaFromBrowser } from "@/lib/portfolio/upload-client"
import type { ArchClient } from "@/lib/portfolio/types"
import { cn } from "@/lib/utils"

export function PortfolioCreateWorkspace({
  clients,
}: {
  clients: ArchClient[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function submit(payload: PortfolioProjectSubmit) {
    startTransition(async () => {
      const toastId = toast.loading("Creating project...")

      let clientId = payload.client.id

      if (!clientId) {
        const clientResult = await createArchClientAction({
          name: payload.client.name,
          phone: payload.client.phone,
        })

        if (!clientResult.ok) {
          toast.error(clientResult.error, { id: toastId })
          return
        }

        clientId = clientResult.data.id
      }

      const projectResult = await createArchProjectAction({
        ...payload.project,
        client_id: clientId,
      })

      if (!projectResult.ok) {
        toast.error(projectResult.error, { id: toastId })
        return
      }

      let uploadFailures = 0
      for (const [index, file] of payload.files.entries()) {
        const uploadResult = await uploadArchProjectMediaFromBrowser(
          projectResult.data.id,
          file,
          {
            caption: null,
            phase: null,
            is_public: payload.project.is_public,
            is_cover: index === 0,
            sort_order: index,
          }
        )

        if (!uploadResult.ok) {
          uploadFailures += 1
        }
      }

      if (uploadFailures > 0) {
        toast.warning(
          `Project created, but ${uploadFailures} image upload${uploadFailures === 1 ? "" : "s"} failed.`,
          { id: toastId }
        )
      } else {
        toast.success("Project created", { id: toastId })
      }

      router.push(`/jr-suthar-and-designs/${projectResult.data.id}`)
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New Project
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Create a client project and upload the first set of portfolio images.
          </p>
        </div>
        <Link
          href="/jr-suthar-and-designs"
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "shadow-none"
          )}
        >
          Back
        </Link>
      </div>

      <PortfolioProjectForm
        mode="create"
        clients={clients}
        pending={isPending}
        onSubmit={submit}
      />
    </div>
  )
}
