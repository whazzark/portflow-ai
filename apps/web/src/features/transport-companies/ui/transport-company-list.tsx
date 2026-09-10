import { HighlightedText } from '@/components/highlighted-text'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { TransportCompanyRowActions } from '@/features/transport-companies/ui/transport-company-row-actions'
import { classnames } from '@/libraries/shadcn/helpers'

type TransportCompanyListProps = {
  companies: TransportCompanyDto[]
  lifecycle: 'all' | 'available' | 'archived'
  search: string
  selectedId?: string
  emptyTitle: string
  emptyDescription: string
  onSelect: (id: string) => void
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onCreate?: () => void
  canAdminister?: boolean
  showStatus?: boolean
  selectedIds?: ReadonlySet<string>
  onToggleSelection?: (id: string) => void
  onToggleVisible?: (ids: string[], select: boolean) => void
}

export function TransportCompanyList({
  companies,
  lifecycle,
  search,
  selectedId,
  emptyTitle,
  emptyDescription,
  onSelect,
  onView,
  onEdit,
  onCreate,
  canAdminister = false,
  showStatus = false,
  selectedIds,
  onToggleSelection,
  onToggleVisible,
}: TransportCompanyListProps) {
  const ordered = [...companies].sort((left, right) => {
    const byName = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })

    if (byName === 0) {
      return left.id.localeCompare(right.id)
    }

    return byName
  })
  const visibleIds = ordered.map((company) => company.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds?.has(id))
  const someVisibleSelected = visibleIds.some((id) => selectedIds?.has(id))

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {onToggleVisible && ordered.length > 0 && (
        <div className="flex items-center gap-2 border-b py-2 pr-3 pl-5">
          <Checkbox
            aria-label="Select all visible transport companies"
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected && !allVisibleSelected}
            onCheckedChange={(checked) => onToggleVisible(visibleIds, checked === true)}
          />
          <span className="text-muted-foreground text-sm">Select all</span>
        </div>
      )}
      {ordered.length > 0 ? (
        <ul
          aria-label={
            lifecycle === 'all'
              ? 'Transport companies'
              : `${lifecycle === 'archived' ? 'Archived' : 'Available'} transport companies`
          }
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2"
        >
          {ordered.map((company) => {
            const selected = company.id === selectedId

            return (
              <li key={company.id}>
                <div
                  className={classnames(
                    'flex items-center rounded-lg border border-transparent transition-colors duration-150 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/70',
                    selected && 'border-border bg-muted hover:bg-muted',
                  )}
                >
                  {onToggleSelection && (
                    <Checkbox
                      aria-label={`Select ${company.name}`}
                      checked={selectedIds?.has(company.id) ?? false}
                      className="ml-3"
                      onCheckedChange={() => onToggleSelection(company.id)}
                    />
                  )}
                  {/* `aria-pressed` rather than `aria-current`: the row's body toggles a filter
                      that is on or off, it does not mark the page the reader is on. The id stays
                      in the accessible name — two companies may share a name, and it is the only
                      thing telling their rows apart. */}
                  <button
                    aria-label={`${company.name}, ${company.id}`}
                    aria-pressed={selected}
                    className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-left focus-visible:outline-none"
                    onClick={() => onSelect(company.id)}
                    type="button"
                  >
                    <span className="block truncate font-medium">
                      <HighlightedText search={search} value={company.name} />
                    </span>
                    <span className="mt-1 block truncate text-[0.7rem] text-muted-foreground">
                      {showStatus &&
                        `${company.status === 'ARCHIVED' ? 'Archived' : 'Available'} · `}
                      {company.contactPhone && company.contactEmail
                        ? `${company.contactPhone} · ${company.contactEmail}`
                        : 'No contact details recorded'}
                    </span>
                  </button>
                  <TransportCompanyRowActions
                    canAdminister={canAdminister}
                    company={company}
                    onEdit={onEdit}
                    onView={onView}
                  />
                </div>
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
          {canAdminister && onCreate && (
            <EmptyContent>
              {/* Deliberately worded apart from the header's own "Create transport company":
                  both are on screen at once, and two buttons sharing an accessible name is worse
                  than the small wording difference. */}
              <Button onClick={onCreate} size="sm">
                Create a transport company
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
