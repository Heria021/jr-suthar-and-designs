"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { createProductAction, type ProductPayload } from "@/app/(app)/products/actions"
import { ProductForm } from "@/components/products/product-form"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ProductCreateWorkspace() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function submit(payload: ProductPayload) {
    startTransition(async () => {
      const toastId = toast.loading("Creating product...")
      const result = await createProductAction(payload)

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      toast.success("Product created", { id: toastId })
      router.push(`/products/${result.data.id}`)
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            New Product
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Create a product with pricing, packaging, reorder level, and opening stock.
          </p>
        </div>
        <Link
          href="/products"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
        >
          Back
        </Link>
      </div>

      <div className="space-y-3 mt-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">Product details</h2>
          <p className="text-xs text-muted-foreground">
            Fill in the product name, pricing, unit, and opening stock.
          </p>
        </div>
        <ProductForm mode="create" pending={isPending} onSubmit={submit} />
      </div>
    </div>
  )
}
