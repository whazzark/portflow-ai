import { PlusIcon, Trash2Icon } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { classnames } from '@/libraries/shadcn/helpers'

/** Column titles above a list of rows; each field keeps its own label for assistive technologies. */
export function ColumnHeaders({ columns, titles }: { columns: string; titles: string[] }) {
  return (
    <div
      aria-hidden="true"
      className={classnames('hidden gap-x-3 font-medium text-muted-foreground text-xs', columns)}
    >
      {titles.map((title) => (
        <span key={title}>{title}</span>
      ))}
    </div>
  )
}

/**
 * One row of an array field. A legend names its fieldset only as its first child, so it stays for
 * assistive technologies; the visible title only appears where rows stack, on narrow screens, where
 * the row's trailing action is lifted beside it rather than left alone on a line of its own.
 */
export function RepeatedRow({
  label,
  children,
  stackedTitleClassName = 'md:hidden',
  className = 'md:first:pt-0 md:last:pb-0',
}: {
  label: string
  children: ReactNode
  /** Hides the visible title where the row is laid out on one line. */
  stackedTitleClassName?: string
  className?: string
}) {
  return (
    <fieldset className={classnames('relative flex flex-col gap-2 py-3', className)}>
      <legend className="sr-only">{label}</legend>
      <p aria-hidden="true" className={classnames('font-medium text-sm', stackedTitleClassName)}>
        {label}
      </p>
      {children}
    </fieldset>
  )
}

export function RemoveRowButton({
  label,
  canRemove,
  onRemove,
}: {
  label: string
  canRemove: boolean
  onRemove: () => void
}) {
  return (
    <Button
      aria-label={`Remove ${label.toLowerCase()}`}
      disabled={!canRemove}
      onClick={onRemove}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Trash2Icon aria-hidden="true" />
    </Button>
  )
}

/** An optional field kept out of the way until asked for, or until it already holds something. */
export function OnDemand({
  children,
  hasContent,
  label,
}: {
  /** Receives whether the field was opened by the user rather than shown for its content. */
  children: (openedOnDemand: boolean) => ReactNode
  hasContent: boolean
  label: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (isOpen || hasContent) {
    return <div>{children(isOpen)}</div>
  }

  return (
    <Button
      className="self-start text-muted-foreground"
      onClick={() => setIsOpen(true)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <PlusIcon aria-hidden="true" />
      {label}
    </Button>
  )
}
