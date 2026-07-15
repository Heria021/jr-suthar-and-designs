import { PortfolioCreateWorkspace } from "@/components/portfolio/portfolio-create-workspace"
import { getArchClients } from "@/lib/portfolio/data"

export default async function NewArchitectureProjectPage() {
  const clients = await getArchClients()

  return <PortfolioCreateWorkspace clients={clients} />
}
