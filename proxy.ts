import { NextResponse, type NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

const AUTHENTICATED_ROUTE = "/dashboard"

function isPublicRoute(pathname: string) {
  return pathname === "/" || pathname.startsWith("/projects/")
}

function isAuthRoute(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/auth/")
}

function shouldRedirectAuthenticatedUser(pathname: string) {
  return pathname === "/login" || pathname === "/auth/forgot-password"
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (!user && !isAuthRoute(pathname) && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && shouldRedirectAuthenticatedUser(pathname)) {
    return NextResponse.redirect(new URL(AUTHENTICATED_ROUTE, request.url))
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
