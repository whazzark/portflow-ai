import { HighlightedText } from '@/components/highlighted-text'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { classnames } from '@/libraries/shadcn/helpers'

type TransportCompanyListProps = {
  companies: TransportCompanyDto[]
  lifecycle: 'available' | 'archived'
  search: string
  selectedId?: string
  emptyTitle: string
  emptyDescription: string
  onSelect: (id: string) => void
}

export function TransportCompanyList({
  companies,
  lifecycle,
  search,
  selectedId,
  emptyTitle,
  emptyDescription,
  onSelect,
}: TransportCompanyListProps) {
  const ordered = [...companies].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })

    if (byName === 0) {
      return left.id.localeCompare(right.id)
    }

    return byName
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {ordered.length > 0 ? (
        <ul
          aria-label={`${lifecycle === 'archived' ? 'Archived' : 'Available'} transport companies`}
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          {ordered.map((company) => {
            const selected = company.id === selectedId

            return (
              <li key={company.id}>
                <button
                  aria-label={`${company.name}, ${company.id}`}
                  aria-current={selected ? 'true' : undefined}
                  className={classnames(
                    'w-full cursor-pointer rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    selected && 'border-border bg-muted',
                  )}
                  onClick={() => onSelect(company.id)}
                  type="button"
                >
                  <span className="block truncate font-medium">
                    <HighlightedText search={search} value={company.name} />
                  </span>
                  <span className="mt-1 block break-all font-mono text-[0.7rem] text-muted-foreground">
                    {company.id}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty className="min-h-52 flex-1 border-0">
          <EmptyHeader>
            <EmptyTitle>{emptyTitle}</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
