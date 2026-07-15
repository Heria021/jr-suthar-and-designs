"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2 } from "lucide-react"

import {
  requestPasswordReset,
  type AuthActionState,
} from "@/app/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ForgotPasswordForm() {
  const [state, setState] = useState<AuthActionState>()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="auth-animate auth-animate-1 space-y-1">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-primary/10">
          <span className="text-lg font-bold text-primary">N</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Enter the owner email and we&apos;ll send reset instructions.
        </p>
      </div>

      <form
        action={(formData) => {
          setState(undefined)
          startTransition(async () => {
            const result = await requestPasswordReset(formData)
            setState(result)
          })
        }}
        className="auth-animate auth-animate-2 space-y-4"
      >
        {state?.error ? (
          <Alert variant="destructive" className="error-animate">
            <AlertCircle className="size-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state?.success ? (
          <Alert className="success-animate border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 className="size-4 text-emerald-700" />
            <AlertDescription className="text-emerald-800">
              {state.success}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-3">
          <Label htmlFor="reset-email">
            Email address
          </Label>
          <Input
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
          size="lg"
        >
          {isPending ? "Sending..." : "Send reset instructions"}
        </Button>
      </form>

      <Link
        href="/login"
        className="auth-animate auth-animate-3 block text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to sign in
      </Link>
    </div>
  )
}
