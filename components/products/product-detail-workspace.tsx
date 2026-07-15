"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import type { ProductRow } from "@/app/(app)/products/page"
import {
  correctStockAction,
  deactivateProductAction,
  reactivateProductAction,
  type ProductPayload,
  type StockMovementRow,
  updateProductAction,
} from "@/app/(app)/products/actions"
import {
  CorrectStockForm,
  ProductDetailsSection,
  ProductForm,
  StockHistorySection,
} from "@/components/products/product-form"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

export function ProductDetailWorkspace({
  product,
  movements,
}: {
  product: ProductRow
  movements: StockMovementRow[]
}) {
  const router = useRouter()
  const [currentProduct, setCurrentProduct] = useState(product)
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  function refreshPage() {
    router.refresh()
  }

  function update(payload: ProductPayload) {
    startTransition(async () => {
      const toastId = toast.loading("Saving product changes...")
      const result = await updateProductAction(
        currentProduct.id,
        currentProduct.version,
        payload
      )

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      const productFields: Partial<ProductRow> = {
        name: payload.name,
        sku: payload.sku,
        unit_name: payload.unit_name,
        loose_sale_price: payload.loose_sale_price,
        loose_cost_price: payload.loose_cost_price,
        has_box: payload.has_box,
        box_units: payload.box_units,
        box_sale_price: payload.box_sale_price,
        box_cost_price: payload.box_cost_price,
        reorder_level: payload.reorder_level,
      }

      setCurrentProduct((entry) => ({
        ...entry,
        ...productFields,
        version: entry.version + 1,
      }))
      toast.success("Product details saved", { id: toastId })
      refreshPage()
    })
  }

  function deactivate() {
    startTransition(async () => {
      const toastId = toast.loading("Deactivating product...")
      const result = await deactivateProductAction(
        currentProduct.id,
        currentProduct.version
      )

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      setCurrentProduct((entry) => ({
        ...entry,
        is_active: false,
        version: entry.version + 1,
      }))
      toast.success("Product deactivated", { id: toastId })
      refreshPage()
    })
  }

  function reactivate() {
    startTransition(async () => {
      const toastId = toast.loading("Reactivating product...")
      const result = await reactivateProductAction(
        currentProduct.id,
        currentProduct.version
      )

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      setCurrentProduct((entry) => ({
        ...entry,
        is_active: true,
        version: entry.version + 1,
      }))
      toast.success("Product reactivated", { id: toastId })
      refreshPage()
    })
  }

  function correctStock(actualStock: number, reason: string) {
    startTransition(async () => {
      const toastId = toast.loading("Correcting stock...")
      const result = await correctStockAction(
        currentProduct.id,
        actualStock,
        reason
      )

      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }

      setCurrentProduct((entry) => ({
        ...entry,
        stock_on_hand: actualStock,
        version:
          result.data.quantity_delta === 0 ? entry.version : entry.version + 1,
      }))
      toast.success(
        `Stock corrected (${result.data.quantity_delta >= 0 ? "+" : ""}${result.data.quantity_delta})`,
        { id: toastId }
      )
      refreshPage()
    })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {currentProduct.name}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Product detail, inventory status, stock history, and editable pricing in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="shadow-none cursor-pointer"
            onClick={() => setIsEditing(!isEditing)}
          >
            Edit
          </Button>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "shadow-none")}
          >
            Back
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {isEditing ? (
          <div className="space-y-6 mt-2">
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Edit details</h2>
                <p className="text-xs text-muted-foreground">
                  Update product name, sku, unit, loose prices, or box pricing details.
                </p>
              </div>
              <ProductForm
                key={`${currentProduct.id}-${currentProduct.version}`}
                mode="edit"
                product={currentProduct}
                pending={isPending}
                onSubmit={(payload) => {
                  update(payload)
                  setIsEditing(false)
                }}
                onCancel={() => setIsEditing(false)}
              />
            </div>

            <Separator className="my-2" />

            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Correct stock</h2>
                <p className="text-xs text-muted-foreground">
                  Correct physical counted stock and provide adjustment reason.
                </p>
              </div>
              <CorrectStockForm
                product={currentProduct}
                pending={isPending}
                onSubmit={(actualStock, reason) => {
                  correctStock(actualStock, reason)
                  setIsEditing(false)
                }}
              />
            </div>
          </div>
        ) : (
          <>
            <ProductDetailsSection
              product={currentProduct}
              pending={isPending}
              onDeactivate={deactivate}
              onReactivate={reactivate}
            />
            <StockHistorySection movements={movements} />
          </>
        )}
      </div>
    </div>
  )
}
