import { createFileRoute } from '@tanstack/react-router'
import { OperationsOverview } from '@/components/layout/operations-overview'

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})

function HomePage() {
  return <OperationsOverview />
}
