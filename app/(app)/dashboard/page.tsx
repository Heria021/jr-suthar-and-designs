import { Suspense } from "react"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardOverview } from "@/components/dashboard/dashboard-overview"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { getDashboardOverview } from "@/lib/dashboard/data"

export default function DashboardPage() {
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Overview
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            A clear view of sales, payments, stock, and recent activity.
          </p>
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  )
}

async function DashboardData() {
  let data

  try {
    data = await getDashboardOverview()
  } catch {
    return <DashboardError />
  }

  return <DashboardOverview data={data} />
}
