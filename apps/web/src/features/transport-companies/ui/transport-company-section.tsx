import { transportCompanyMatchesSearch } from '@/features/transport-companies/helpers/transport-company-search'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { TransportCompanyList } from '@/features/transport-companies/ui/transport-company-list'

type TransportCompanySectionProps = {
  companies: TransportCompanyDto[]
  lifecycle: 'all' | 'available' | 'archived'
  search: string
  selectedId?: string
  onSelect: (id: string) => void
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  canAdminister?: boolean
  showStatus?: boolean
}

export function TransportCompanySection({
  companies,
  lifecycle,
  search,
  selectedId,
  onSelect,
  onView,
  onEdit,
  canAdminister,
  showStatus,
}: TransportCompanySectionProps) {
  const matches = companies.filter((company) => transportCompanyMatchesSearch(company, search))
  const hasSearch = search.trim().length > 0

  return (
    <section
      aria-label={
        lifecycle === 'all'
          ? 'Transport companies'
          : `${lifecycle === 'archived' ? 'Archived' : 'Available'} transport companies`
      }
      className="md:h-full md:min-h-0"
    >
      <TransportCompanyList
        companies={matches}
        emptyDescription={
          hasSearch
            ? 'Try a different company name.'
            : 'No transport companies exist in this lifecycle state.'
        }
        emptyTitle={
          hasSearch ? 'No matching transport companies' : `No ${lifecycle} transport companies`
        }
        canAdminister={canAdminister}
        lifecycle={lifecycle}
        onEdit={onEdit}
        onSelect={onSelect}
        onView={onView}
        search={search}
        selectedId={selectedId}
        showStatus={showStatus}
      />
    </section>
  )
}
