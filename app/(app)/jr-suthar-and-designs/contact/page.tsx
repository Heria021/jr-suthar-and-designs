import { PortfolioInquiriesWorkspace } from "@/components/portfolio/portfolio-inquiries-workspace"
import { getArchInquiries } from "@/lib/portfolio/inquiries"

export default async function JrSutharContactInquiriesPage() {
  const inquiries = await getArchInquiries()

  return <PortfolioInquiriesWorkspace inquiries={inquiries} />
}
