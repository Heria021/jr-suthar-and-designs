import { ReportsWorkspace } from "@/components/reports/reports-workspace"
import { getReportsData } from "@/lib/reports/data"

export default async function ReportsPage() {
  const data = await getReportsData()
  return <ReportsWorkspace data={data} />
}
