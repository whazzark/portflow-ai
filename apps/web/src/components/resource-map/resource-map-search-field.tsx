import { Autocomplete } from '@base-ui/react/autocomplete'
import { SearchIcon, XIcon } from 'lucide-react'
import { type ReactNode, useId, useRef } from 'react'
import { normalizeResourceSearch } from '@/components/resource-map/resource-map-search'
import { classnames } from '@/libraries/shadcn/helpers'

export type ResourceMapSearchItem = {
  id: string
  name: string
  kindLabel: string
  icon?: ReactNode
}

/** Wraps the part of `name` matching `search` in a `<mark>`, ignoring case and accents. */
function HighlightedName({ name, search }: { name: string; search: string }) {
  const needle = normalizeResourceSearch(search)
  // Normalising one character at a time keeps indexes aligned with the original name, so the
  // highlighted slice is the user's own spelling, accents included.
  const folded = [...name].map((character) => normalizeResourceSearch(character) || character)
  const haystack = folded.join('')
  const start = needle ? haystack.indexOf(needle) : -1
  if (start < 0) {
    return <>{name}</>
  }
  let offset = 0
  let from = -1
  let to = -1
  folded.forEach((part, index) => {
    if (from < 0 && offset >= start) {
      from = index
    }
    offset += part.length
    if (to < 0 && offset >= start + needle.length) {
      to = index + 1
    }
  })
  const characters = [...name]

  return (
    <>
      {characters.slice(0, from).join('')}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">
        {characters.slice(from, to).join('')}
      </mark>
      {characters.slice(to).join('')}
    </>
  )
}

/**
 * The search field of a map's floating toolbar. While it holds text it lists the matching records
 * under the field: picking one hands its id to `onPick` — the field keeps the text the user typed —
 * and Enter without a highlighted match asks to frame every match (`onSubmitAll`). The caller owns
 * matching, so `items` are shown exactly as given.
 */
export function ResourceMapSearch({
  label,
  listLabel,
  value,
  onValueChange,
  items,
  onPick,
  onSubmitAll,
  footer,
}: {
  label: string
  listLabel: string
  value: string
  onValueChange: (value: string) => void
  items: ResourceMapSearchItem[]
  onPick: (id: string) => void
  onSubmitAll: () => void
  footer?: ReactNode
}) {
  const inputId = useId()
  const highlighted = useRef<ResourceMapSearchItem | undefined>(undefined)

  return (
    <Autocomplete.Root
      items={items}
      itemToStringValue={(item: ResourceMapSearchItem) => item.name}
      mode="none"
      onItemHighlighted={(item) => {
        highlighted.current = item
      }}
      onValueChange={(next, details) => {
        // Picking a match selects the record; it does not replace what the user searched for.
        if (details.reason !== 'item-press') {
          onValueChange(next)
        }
      }}
      openOnInputClick
      value={value}
    >
      <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
        <label className="sr-only" htmlFor={inputId}>
          {label}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Autocomplete.Input
          className={classnames(
            'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30',
            value ? 'pr-9' : 'pr-2.5',
          )}
          id={inputId}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !highlighted.current && value.trim()) {
              event.preventDefault()
              onSubmitAll()
            }
          }}
          placeholder={label}
        />
        {value && (
          <button
            aria-label={`Clear ${label.toLocaleLowerCase()} input`}
            className="absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onValueChange('')}
            type="button"
          >
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      {value.trim() && items.length > 0 && (
        <Autocomplete.Portal>
          <Autocomplete.Positioner align="start" className="isolate z-50" sideOffset={8}>
            <Autocomplete.Popup className="w-(--anchor-width) min-w-72 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
              <Autocomplete.List aria-label={listLabel} className="max-h-72 overflow-y-auto">
                {(item: ResourceMapSearchItem) => (
                  <Autocomplete.Item
                    className="flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                    key={item.id}
                    onClick={() => onPick(item.id)}
                    value={item}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1 truncate">
                      <HighlightedName name={item.name} search={value} />
                    </span>
                    <span className="shrink-0 text-muted-foreground text-xs">{item.kindLabel}</span>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
              {footer && (
                <div className="border-t px-2 pt-1.5 pb-1 text-muted-foreground text-xs">
                  {footer}
                </div>
              )}
            </Autocomplete.Popup>
          </Autocomplete.Positioner>
        </Autocomplete.Portal>
      )}
    </Autocomplete.Root>
  )
}
