import { Skeleton } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between pb-3 border-b border-border/40">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-[280px] w-full" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>

      <section className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <ListSkeleton />
          <ListSkeleton />
          <ListSkeleton />
        </div>
      </section>
    </div>
  )
}

function ChartCardSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-border/40">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <Skeleton className="mx-auto h-[220px] w-full" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </section>
  )
}

function ListSkeleton() {
  return (
    <section className="flex flex-col space-y-3">
      <div className="border-b border-border/40 pb-2">
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </section>
  )
}
