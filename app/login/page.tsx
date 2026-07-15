import { LoginForm } from "@/components/login-form"

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
    message?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <LoginForm initialError={params.error} initialMessage={params.message} />
    </div>
  )
}
