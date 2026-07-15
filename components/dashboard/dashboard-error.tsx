"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { RefreshCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function DashboardError() {
  const router = useRouter()

  useEffect(() => {
    toast.error("We couldn't load the overview. Please try again.")
  }, [])

  return (
    <section className="rounded-lg border bg-background p-6">
      <div className="max-w-xl space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          We couldn&apos;t load the overview.
        </h2>
        <p className="text-sm text-muted-foreground">Please try again.</p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5 shadow-none"
          onClick={() => router.refresh()}
        >
          <RefreshCcwIcon className="size-3.5" />
          Retry
        </Button>
      </div>
    </section>
  )
}
