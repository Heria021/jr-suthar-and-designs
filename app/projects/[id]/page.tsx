import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PublicProjectDetail } from "@/components/public-site/public-project-detail"
import { getPublicPortfolioProject } from "@/lib/portfolio/public-data"
import { projectTypeLabels } from "@/lib/portfolio/types"

type PublicProjectPageProps = {
  params: Promise<{ id: string }>
}

function projectTitle(project: Awaited<ReturnType<typeof getPublicPortfolioProject>>) {
  if (!project) {
    return "Project"
  }

  return (
    project.public_title ||
    [projectTypeLabels[project.project_type], project.location]
      .filter(Boolean)
      .join(" - ")
  )
}

export async function generateMetadata({
  params,
}: PublicProjectPageProps): Promise<Metadata> {
  const { id } = await params
  const project = await getPublicPortfolioProject(id)

  if (!project) {
    return {
      title: "Project not found | JR Suthar & Designs",
    }
  }

  const title = projectTitle(project)

  return {
    title: `${title} | JR Suthar & Designs`,
    description:
      project.public_description ||
      [projectTypeLabels[project.project_type], project.location]
        .filter(Boolean)
        .join(" in "),
  }
}

export default async function PublicProjectPage({
  params,
}: PublicProjectPageProps) {
  const { id } = await params
  const project = await getPublicPortfolioProject(id)

  if (!project) {
    notFound()
  }

  return <PublicProjectDetail project={project} />
}
