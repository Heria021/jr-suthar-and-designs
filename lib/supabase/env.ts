export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? ""
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ""
}

export function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^/, "https://") ??
    "http://localhost:3000"
  )
}

function assertHttpUrl(name: string, value: string) {
  try {
    const parsed = new URL(value)
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("invalid protocol")
    }
  } catch {
    throw new Error(`${name} must be a valid http(s) URL.`)
  }
}

function assertConfigured(name: string, value: string) {
  if (!value || value.includes("your-") || value.includes("change-this")) {
    throw new Error(`Missing ${name}. Configure it before running the app.`)
  }
}

export function assertSupabaseEnv() {
  const supabaseUrl = getSupabaseUrl()
  const supabaseAnonKey = getSupabaseAnonKey()

  assertConfigured("Supabase URL", supabaseUrl)
  assertConfigured("Supabase anon key", supabaseAnonKey)
  assertHttpUrl("Supabase URL", supabaseUrl)

  return { supabaseUrl, supabaseAnonKey }
}
