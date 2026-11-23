import { Autocomplete } from '@base-ui/react/autocomplete'
import { SearchIcon, XIcon } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { classnames } from '@/libraries/shadcn/helpers'

export type ResourceMapSearchGroup<Item> = {
  /** Also the group's heading. */
  label: string
  items: Item[]
}

/**
 * The map toolbar's search: a combobox whose suggestions are the matching records, grouped when a
 * map holds several kinds (warehouses and their doors). The caller filters — the list is shown as
 * given — and owns the text, which lives in the URL. Picking a suggestion, by click or by Enter on
 * the highlighted one, calls `onSelect` and leaves the text as typed.
 */
export function ResourceMapSearch<Item>({
  id,
  label,
  value,
  onValueChange,
  groups,
  getItemKey,
  renderItem,
  onSelect,
  footer,
  className,
}: {
  id: string
  /** The field's accessible name and placeholder, e.g. `Search warehouses`. */
  label: string
  value: string
  onValueChange: (value: string) => void
  groups: ResourceMapSearchGroup<Item>[]
  getItemKey: (item: Item) => string
  renderItem: (item: Item) => ReactNode
  onSelect: (item: Item) => void
  footer?: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const shownGroups = groups.filter((group) => group.items.length > 0)
  const hasResults = value.trim().length > 0 && shownGroups.length > 0

  return (
    <Autocomplete.Root
      items={shownGroups.map((group) => ({ value: group.label, items: group.items }))}
      mode="none"
      onOpenChange={setOpen}
      onValueChange={(next, details) => {
        // A picked suggestion is reported here too; only typing and clearing change the text.
        if (
          details.reason === 'input-change' ||
          details.reason === 'input-clear' ||
          details.reason === 'clear-press'
        ) {
          onValueChange(next)
        }
      }}
      open={open && hasResults}
      value={value}
    >
      <div className={classnames('relative min-w-0 flex-1 sm:w-72 sm:flex-none', className)}>
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Autocomplete.Input
          className={classnames(
            'h-8 w-full min-w-0 rounded-lg border border-input bg-background py-1 pl-9 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30',
            value ? 'pr-9' : 'pr-2.5',
          )}
          id={id}
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
      <Autocomplete.Portal>
        <Autocomplete.Positioner align="start" className="isolate z-50" sideOffset={6}>
          <Autocomplete.Popup className="max-h-[min(var(--available-height),24rem)] w-[max(var(--anchor-width),20rem)] overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
            <Autocomplete.List aria-label="Search results">
              {(group: { value: string; items: Item[] }) => (
                <Autocomplete.Group className="py-1" items={group.items} key={group.value}>
                  <Autocomplete.GroupLabel className="flex items-center justify-between px-2 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
                    <span>{group.value}</span>
                    <span>{group.items.length}</span>
                  </Autocomplete.GroupLabel>
                  <Autocomplete.Collection>
                    {(item: Item) => (
                      <Autocomplete.Item
                        className="flex cursor-default select-none flex-col rounded-md px-2 py-1.5 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                        key={getItemKey(item)}
                        onClick={() => {
                          setOpen(false)
                          onSelect(item)
                        }}
                        value={item}
                      >
                        {renderItem(item)}
                      </Autocomplete.Item>
                    )}
                  </Autocomplete.Collection>
                </Autocomplete.Group>
              )}
            </Autocomplete.List>
            {footer && (
              <div className="border-t px-2 pt-2 pb-1 text-muted-foreground text-xs">{footer}</div>
            )}
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}

/** Wraps the part of `text` matching `search` in a `<mark>`, ignoring case — accents are matched by
 * the caller's own search, so an accented match is simply left unmarked. */
export function HighlightedMatch({ text, search }: { text: string; search: string }) {
  const needle = search.trim().toLocaleLowerCase('en')
  const start = needle ? text.toLocaleLowerCase('en').indexOf(needle) : -1
  if (start < 0) {
    return text
  }

  return (
    <>
      {text.slice(0, start)}
      <mark className="rounded-sm bg-primary/20 text-inherit">
        {text.slice(start, start + needle.length)}
      </mark>
      {text.slice(start + needle.length)}
    </>
  )
}
