"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react"

import {
  signInWithMagicLink,
  signInWithPassword,
  type AuthActionState,
} from "@/app/auth/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

type LoginFormProps = {
  initialError?: string
  initialMessage?: string
}

function messageForCode(code?: string) {
  if (!code) return undefined
  if (code === "password-updated") {
    return "Password updated. Sign in with your new password."
  }
  return undefined
}

function errorForCode(code?: string) {
  if (!code) return undefined
  if (code === "missing-code" || code === "callback-failed") {
    return "Could not complete sign in. Request a new link and try again."
  }
  return "Could not complete sign in. Try again."
}

function AuthNotice({
  state,
  fallbackError,
  fallbackMessage,
}: {
  state?: AuthActionState
  fallbackError?: string
  fallbackMessage?: string
}) {
  const error = state?.error ?? fallbackError
  const success = state?.success ?? fallbackMessage

  if (error) {
    return (
      <div className="error-animate flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="size-4" />
        <span>{error}</span>
      </div>
    )
  }

  if (success) {
    return (
      <Alert className="success-animate border-border bg-muted/40">
        <CheckCircle2 className="size-4 text-emerald-700" />
        <AlertDescription>{success}</AlertDescription>
      </Alert>
    )
  }

  return null
}

export function LoginForm({ initialError, initialMessage }: LoginFormProps) {
  const [passwordState, setPasswordState] = useState<AuthActionState>()
  const [magicState, setMagicState] = useState<AuthActionState>()
  const [magicEmail, setMagicEmail] = useState("")
  const [isPasswordPending, startPasswordTransition] = useTransition()
  const [isMagicPending, startMagicTransition] = useTransition()

  const callbackError = useMemo(() => errorForCode(initialError), [initialError])
  const callbackMessage = useMemo(
    () => messageForCode(initialMessage),
    [initialMessage]
  )

  return (
    <div className="w-full max-w-md space-y-8">
      <div className="auth-animate auth-animate-1 space-y-1">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-primary/10">
          <span className="text-lg font-bold text-primary">N</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to Narayani Traders ERP
        </p>
      </div>

      <div className="auth-animate auth-animate-2">
        <Tabs defaultValue="password" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password" className="gap-2">
              <Lock className="size-3.5" />
              Password
            </TabsTrigger>
            <TabsTrigger value="magic" className="gap-2">
              <Sparkles className="size-3.5" />
              Magic Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="tab-panel mt-0 space-y-4">
            <form
              action={(formData) => {
                setPasswordState(undefined)
                startPasswordTransition(async () => {
                  const result = await signInWithPassword(formData)
                  setPasswordState(result)
                })
              }}
              className="space-y-4"
            >
              <AuthNotice
                state={passwordState}
                fallbackError={callbackError}
                fallbackMessage={callbackMessage}
              />
              <div className="space-y-1.5">
                <Label htmlFor="password-email">Email address</Label>
                <Input
                  id="password-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@narayanitraders.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isPasswordPending}
                className="w-full"
                size="lg"
              >
                {isPasswordPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="magic" className="tab-panel mt-0 space-y-4">
            {magicState?.success ? (
              <div className="success-animate space-y-3 rounded-lg border border-border bg-muted/40 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Check your inbox</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      We sent a magic link to{" "}
                      <span className="font-medium text-foreground">
                        {magicEmail}
                      </span>
                      .
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMagicEmail("")
                    setMagicState(undefined)
                  }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form
                action={(formData) => {
                  setMagicState(undefined)
                  setMagicEmail(String(formData.get("email") ?? ""))
                  startMagicTransition(async () => {
                    const result = await signInWithMagicLink(formData)
                    setMagicState(result)
                  })
                }}
                className="space-y-4"
              >
                <AuthNotice state={magicState} />
                <div className="space-y-1.5">
                  <Label htmlFor="magic-email">Email address</Label>
                  <Input
                    id="magic-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@narayanitraders.com"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We&apos;ll email you a secure one-time link.
                </p>
                <Button
                  type="submit"
                  disabled={isMagicPending}
                  className="w-full"
                  size="lg"
                >
                  {isMagicPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="size-4" />
                      Send magic link
                    </>
                  )}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <p className="auth-animate auth-animate-3 text-center text-sm text-muted-foreground">
        Owner access only. No self-serve account creation.
      </p>
    </div>
  )
}
