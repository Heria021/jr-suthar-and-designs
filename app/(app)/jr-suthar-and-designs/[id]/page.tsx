import { notFound } from "next/navigation"

import { PortfolioDetailWorkspace } from "@/components/portfolio/portfolio-detail-workspace"
import { getArchClients, getArchProject } from "@/lib/portfolio/data"

export default async function ArchitectureProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [project, clients] = await Promise.all([
    getArchProject(id),
    getArchClients(),
  ])

  if (!project) {
    notFound()
  }

  return <PortfolioDetailWorkspace project={project} clients={clients} />
}
