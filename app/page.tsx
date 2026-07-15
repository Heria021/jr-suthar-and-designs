import type { Metadata } from "next"

import { PortfolioLanding } from "@/components/public-site/portfolio-landing"
import { getPublicPortfolioProjects } from "@/lib/portfolio/public-data"

export const metadata: Metadata = {
  title: "JR Suthar & Designs",
  description:
    "Architecture and interiors portfolio for residential, commercial, and renovation projects.",
}

export default async function PublicHomePage() {
  const projects = await getPublicPortfolioProjects()

  return <PortfolioLanding projects={projects} />
}
