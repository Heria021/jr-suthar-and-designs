import { createClient } from "@/lib/supabase/server"

export type ArchInquiryStatus = "new" | "contacted" | "closed"

export type ArchInquiry = {
  id: string
  name: string
  phone: string
  city: string | null
  pincode: string | null
  message: string
  source_path: string
  status: ArchInquiryStatus
  created_at: string
  updated_at: string
}

export type CreateArchInquiryPayload = {
  name: string
  phone: string
  city: string | null
  pincode: string | null
  message: string
  source_path: string
}

export async function getArchInquiries() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("arch_inquiries")
    .select(
      "id,name,phone,city,pincode,message,source_path,status,created_at,updated_at"
    )
    .order("created_at", { ascending: false })
    .returns<ArchInquiry[]>()

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}
