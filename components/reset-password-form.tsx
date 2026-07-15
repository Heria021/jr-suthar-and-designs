"use client"

import { useState, useTransition } from "react"
import { AlertCircle } from "lucide-react"

import { updatePassword, type AuthActionState } from "@/app/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ResetPasswordForm() {
  const [state, setState] = useState<AuthActionState>()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="auth-animate auth-animate-1 space-y-1">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-primary/10">
          <span className="text-lg font-bold text-primary">N</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for the owner account.
        </p>
      </div>

      <form
        action={(formData) => {
          setState(undefined)
          startTransition(async () => {
            const result = await updatePassword(formData)
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
        <div className="space-y-3">
          <Label htmlFor="password">
            New password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="space-y-3">
          <Label htmlFor="confirmPassword">
            Confirm password
          </Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="w-full"
          size="lg"
        >
          {isPending ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  )
}
