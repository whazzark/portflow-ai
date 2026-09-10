import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export function ResourceStatusBadge({ status }: { status: 'AVAILABLE' | 'ARCHIVED' }) {
  return (
    <Badge variant={status === 'ARCHIVED' ? 'outline' : 'secondary'}>
      {status === 'ARCHIVED' ? 'Archived' : 'Available'}
    </Badge>
  )
}

export function ResourceDetailHeader({
  name,
  status,
  archivedMessage,
}: {
  name: string
  status: 'AVAILABLE' | 'ARCHIVED'
  archivedMessage?: string
}) {
  return (
    <SheetHeader className="shrink-0 border-b">
      <SheetTitle>{name}</SheetTitle>
      <SheetDescription className="flex flex-wrap items-center gap-2">
        <ResourceStatusBadge status={status} />
        {status === 'ARCHIVED' && archivedMessage && <span>{archivedMessage}</span>}
      </SheetDescription>
    </SheetHeader>
  )
}

export function ResourceDetailField({ label, value }: { label: string; value?: string | null }) {
  const isSpecified = value !== undefined && value !== null && value !== ''

  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        {isSpecified ? value : <span className="text-muted-foreground italic">Not specified</span>}
      </dd>
    </div>
  )
}

export function ResourceDetailBody({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">{children}</div>
}
