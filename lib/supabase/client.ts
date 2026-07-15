"use client"

import { createBrowserClient } from "@supabase/ssr"

import { assertSupabaseEnv } from "@/lib/supabase/env"

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = assertSupabaseEnv()

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
