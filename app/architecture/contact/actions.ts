"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import type { CreateArchInquiryPayload } from "@/lib/portfolio/inquiries"

export type ContactInquiryFormState = {
  status: "idle" | "success" | "error"
  message: string
  submittedAt: number
}

function fieldValue(formData: FormData, key: string) {
  const value = formData.get(key)

  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

function optionalFieldValue(formData: FormData, key: string) {
  const value = fieldValue(formData, key)
  return value.length > 0 ? value : null
}

function formError(message: string): ContactInquiryFormState {
  return {
    status: "error",
    message,
    submittedAt: Date.now(),
  }
}

export async function createContactInquiryAction(
  _prevState: ContactInquiryFormState,
  formData: FormData
): Promise<ContactInquiryFormState> {
  const payload: CreateArchInquiryPayload = {
    name: fieldValue(formData, "name"),
    phone: fieldValue(formData, "phone"),
    city: optionalFieldValue(formData, "city"),
    pincode: optionalFieldValue(formData, "pincode"),
    message: fieldValue(formData, "message"),
    source_path: "/architecture/contact",
  }

  if (!payload.name) {
    return formError("Enter your name.")
  }

  if (!payload.phone) {
    return formError("Enter your contact number.")
  }

  if (!payload.city) {
    return formError("Enter your city.")
  }

  if (!payload.message) {
    return formError("Enter a short message.")
  }

  const supabase = await createClient()
  const { error } = await supabase.from("arch_inquiries").insert(payload)

  if (error) {
    return formError(error.message)
  }

  revalidatePath("/jr-suthar-and-designs/contact")

  return {
    status: "success",
    message: "Inquiry received. The studio will contact you soon.",
    submittedAt: Date.now(),
  }
}
