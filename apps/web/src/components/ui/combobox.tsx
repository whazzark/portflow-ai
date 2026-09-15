import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import type * as React from 'react'

import { classnames } from '@/libraries/shadcn/helpers'

/**
 * A select whose options can be searched by typing, styled as `Select`. Base UI filters the items
 * with a locale-aware collator, so a search ignores case and accents.
 */
const Combobox = ComboboxPrimitive.Root

function ComboboxInput({
  adornment,
  className,
  triggerLabel,
  ...props
}: ComboboxPrimitive.Input.Props & {
  /**
   * Shown at the input's end instead of the button that opens the list, such as a spinner while
   * the options load.
   */
  adornment?: React.ReactNode
  /** The accessible name of the button that opens the list without typing. */
  triggerLabel: string
}) {
  return (
    <div data-slot="combobox-control" className="relative flex w-full items-center">
      <ComboboxPrimitive.Input
        data-slot="combobox-input"
        className={classnames(
          'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
          className,
        )}
        {...props}
      />
      {adornment ? (
        <span
          data-slot="combobox-adornment"
          className="absolute right-1 flex size-6 items-center justify-center text-muted-foreground"
        >
          {adornment}
        </span>
      ) : (
        <ComboboxPrimitive.Trigger
          aria-label={triggerLabel}
          data-slot="combobox-trigger"
          className="absolute right-1 flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ChevronDownIcon className="pointer-events-none size-4" />
        </ComboboxPrimitive.Trigger>
      )}
    </div>
  )
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props & Pick<ComboboxPrimitive.Positioner.Props, 'sideOffset'>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className="isolate z-50" sideOffset={sideOffset}>
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={classnames(
            'relative isolate z-50 max-h-[min(var(--available-height),20rem)] w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={classnames('px-1.5 py-1 text-sm text-muted-foreground empty:hidden', className)}
      {...props}
    />
  )
}

const ComboboxList = ComboboxPrimitive.List

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={classnames(
        'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="flex flex-1 whitespace-nowrap">{children}</span>
      <ComboboxPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

export type ComboboxProps = React.ComponentProps<typeof Combobox>

export { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList }
