import { transportCompanyMatchesSearch } from '@/features/transport-companies/helpers/transport-company-search'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { TransportCompanyList } from '@/features/transport-companies/ui/transport-company-list'

type TransportCompanySectionProps = {
  companies: TransportCompanyDto[]
  lifecycle: 'available' | 'archived'
  search: string
  selectedId?: string
  onSelect: (id: string) => void
}

export function TransportCompanySection({
  companies,
  lifecycle,
  search,
  selectedId,
  onSelect,
}: TransportCompanySectionProps) {
  const matches = companies.filter((company) => transportCompanyMatchesSearch(company, search))
  const hasSearch = search.trim().length > 0

  return (
    <section
      aria-label={`${lifecycle === 'archived' ? 'Archived' : 'Available'} transport companies`}
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
        lifecycle={lifecycle}
        onSelect={onSelect}
        search={search}
        selectedId={selectedId}
      />
    </section>
  )
}
