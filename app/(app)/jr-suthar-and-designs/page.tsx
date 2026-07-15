import { PortfolioOverviewWorkspace } from "@/components/portfolio/portfolio-overview-workspace"
import { getArchProjects } from "@/lib/portfolio/data"

export default async function JrSutharOverviewPage() {
  const projects = await getArchProjects()

  return <PortfolioOverviewWorkspace projects={projects} />
}
