import { FilterIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputSearch } from '@/components/ui/input-search'
import {
  RESOURCE_STATUS_FILTERS,
  RESOURCE_STATUS_LABELS,
  type ResourceStatusFilter,
} from './resource-map-types'

export function ResourceMapControls({
  resourceLabel,
  resourceLabelPlural,
  search,
  status,
  counts,
  hasMatches,
  onSearchChange,
  onStatusChange,
  children,
}: {
  resourceLabel: string
  resourceLabelPlural: string
  search: string
  status: ResourceStatusFilter
  counts: Record<ResourceStatusFilter, number>
  hasMatches: boolean
  onSearchChange: (value: string) => void
  onStatusChange: (value: ResourceStatusFilter) => void
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const statusLabel = RESOURCE_STATUS_LABELS[status]

  return (
    <div className="flex max-w-full flex-col gap-2">
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <InputSearch
          className="bg-background/95 shadow-md backdrop-blur"
          fieldClassName="min-w-0 flex-1 sm:w-72"
          id={`${resourceLabel}-search`}
          label={`Search ${resourceLabelPlural}`}
          onValueChange={onSearchChange}
          placeholder={`Search ${resourceLabelPlural}`}
          value={search}
        />
        <DropdownMenu
          modal={false}
          onOpenChange={(nextOpen, details) => {
            if (details.reason !== 'trigger-press') {
              setOpen(nextOpen)
            }
          }}
          open={open}
        >
          <DropdownMenuTrigger
            aria-label={`Filter ${resourceLabelPlural}: ${statusLabel}`}
            onClick={() => setOpen((current) => !current)}
            render={
              <Button
                className="bg-background/95 shadow-md backdrop-blur"
                size="icon"
                type="button"
                variant="outline"
              />
            }
          >
            <FilterIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          {open && (
            <DropdownMenuContent
              align="end"
              aria-label={`${resourceLabelPlural} filters`}
              className="w-56"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  onValueChange={(value) => onStatusChange(value as ResourceStatusFilter)}
                  value={status}
                >
                  {RESOURCE_STATUS_FILTERS.map((value) => (
                    <DropdownMenuRadioItem
                      aria-label={`${RESOURCE_STATUS_LABELS[value]}, ${counts[value]} ${resourceLabelPlural}`}
                      key={value}
                      value={value}
                    >
                      <span>{RESOURCE_STATUS_LABELS[value]}</span>
                      <span aria-hidden="true">({counts[value]})</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
              {children}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
        <Badge
          aria-live="polite"
          className="h-9 bg-background/95 px-3 shadow-md backdrop-blur"
          variant="outline"
        >
          Showing: {statusLabel}
        </Badge>
      </div>
      {search && !hasMatches && (
        <div className="rounded-lg bg-background/95 px-3 py-2 text-sm shadow-md" role="status">
          No {resourceLabelPlural} match “{search}”.{' '}
          <Button className="h-auto p-0" onClick={() => onSearchChange('')} variant="link">
            Clear search
          </Button>
        </div>
      )}
    </div>
  )
}
