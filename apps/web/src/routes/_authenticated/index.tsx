import { createFileRoute } from '@tanstack/react-router'
import {
  isOperationsOverviewSection,
  OperationsOverview,
} from '@/features/operations/ui/operations-overview'

export const Route = createFileRoute('/_authenticated/')({
  staticData: { breadcrumb: 'Overview' },
  validateSearch: (search: Record<string, unknown>) => ({
    section: isOperationsOverviewSection(search.section) ? search.section : 'rotations',
  }),
  component: HomePage,
})

function HomePage() {
  const { section } = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <OperationsOverview
      section={section}
      onSectionChange={(nextSection) => navigate({ search: { section: nextSection } })}
    />
  )
}
