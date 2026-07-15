"use server"

import { redirect } from "next/navigation"

import { getSiteUrl } from "@/lib/supabase/env"
import { createClient } from "@/lib/supabase/server"

export type AuthActionState = {
  error?: string
  success?: string
}

const AUTHENTICATED_ROUTE = "/dashboard"

function readEmail(formData: FormData) {
  return String(formData.get("email") ?? "").trim().toLowerCase()
}

function readPassword(formData: FormData) {
  return String(formData.get("password") ?? "")
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function signInWithPassword(
  formData: FormData
): Promise<AuthActionState> {
  const email = readEmail(formData)
  const password = readPassword(formData)

  if (!validEmail(email) || !password) {
    return { error: "Invalid email or password" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: "Invalid email or password" }
  }

  // TODO: update once dashboard route exists.
  redirect(AUTHENTICATED_ROUTE)
}

export async function signInWithMagicLink(
  formData: FormData
): Promise<AuthActionState> {
  const email = readEmail(formData)

  if (!validEmail(email)) {
    return { error: "Enter a valid email address" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=${AUTHENTICATED_ROUTE}`,
      shouldCreateUser: false,
    },
  })

  if (error) {
    return { error: "Could not send a magic link. Check the email address and try again." }
  }

  return { success: "Magic link sent" }
}

export async function requestPasswordReset(
  formData: FormData
): Promise<AuthActionState> {
  const email = readEmail(formData)

  if (!validEmail(email)) {
    return { error: "Enter a valid email address" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/auth/reset-password`,
  })

  if (error) {
    return { error: "Could not send reset instructions. Try again." }
  }

  return { success: "Password reset instructions sent" }
}

export async function updatePassword(
  formData: FormData
): Promise<AuthActionState> {
  const password = readPassword(formData)
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" }
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match" }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return { error: "Could not update password. Open the reset link again." }
  }

  await supabase.auth.signOut()
  redirect("/login?message=password-updated")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
