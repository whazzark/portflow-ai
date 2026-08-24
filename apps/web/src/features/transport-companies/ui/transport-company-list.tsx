import { EllipsisVerticalIcon } from 'lucide-react'
import { HighlightedText } from '@/components/highlighted-text'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
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
                  <button
                    aria-label={`${company.name}, ${company.id}`}
                    aria-current={selected ? 'true' : undefined}
                    className="min-w-0 flex-1 cursor-pointer px-3 py-2 text-left focus-visible:outline-none"
                    onClick={() => onSelect(company.id)}
                    type="button"
                  >
                    <span className="block truncate font-medium">
                      <HighlightedText search={search} value={company.name} />
                    </span>
                    <span className="mt-1 block truncate font-mono text-[0.7rem] text-muted-foreground">
                      {showStatus &&
                        `${company.status === 'ARCHIVED' ? 'Archived' : 'Available'} · `}
                      {company.id}
                    </span>
                  </button>
                  {onView && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            aria-label={`Actions for ${company.name}`}
                            className="mr-1 shrink-0"
                            size="icon-sm"
                            type="button"
                            variant="ghost"
                          />
                        }
                      >
                        <EllipsisVerticalIcon />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(company.id)}>View</DropdownMenuItem>
                        {canAdminister && onEdit && company.status === 'AVAILABLE' && (
                          <DropdownMenuItem onClick={() => onEdit(company.id)}>
                            Edit
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
              <Button onClick={onCreate} size="sm">
                Create the first transport company
              </Button>
            </EmptyContent>
          )}
        </Empty>
      )}
    </div>
  )
}
