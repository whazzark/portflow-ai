import { XIcon } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'

import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import { ResourceLifecycleHistory } from '@/components/lifecycle/resource-lifecycle-history'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  TransportCompanyLifecycleDialog,
  transportCompanyLifecycleBlocks,
} from '@/features/transport-companies/transport-company-lifecycle'
import type { FleetGroup, FleetTruck } from '@/features/transport-resources/helpers/fleet-view'
import { TruckLifecycleDialog, truckLifecycleBlocks } from '@/features/trucks/truck-lifecycle'
import { formatDateTime } from '@/helpers/dates'
import { FLEET_COLUMN_COUNT } from './company-group-rows'

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * The inline detail area shared by a truck and a company: a labelled region under its row that
 * takes focus when it opens, so a keyboard user lands in it, and closes on Escape.
 */
function DetailRegion({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const closeOnEscape = (event: KeyboardEvent) => {
    // A dialog opened from the detail handles its own Escape first.
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <TableRow className="border-t border-b-0 bg-muted/20 hover:bg-muted/20">
      <TableCell className="whitespace-normal px-12 py-5" colSpan={FLEET_COLUMN_COUNT}>
        <section
          aria-label={label}
          className="flex flex-col gap-5 outline-none"
          onKeyDown={closeOnEscape}
          ref={ref}
          tabIndex={-1}
        >
          {children}
        </section>
      </TableCell>
    </TableRow>
  )
}

export function TruckDetailRow({
  fleetTruck,
  group,
  administrator,
  onEdit,
  onClose,
}: {
  fleetTruck: FleetTruck
  group: FleetGroup
  administrator: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const { truck, status, canReactivate } = fleetTruck
  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)
  const companyArchived = group.company.status === 'ARCHIVED'

  return (
    <DetailRegion label={`Truck ${truck.registration}`} onClose={onClose}>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col gap-3.5">
          <h3 className="font-semibold text-sm">Truck</h3>
          <dl className="flex flex-col gap-2.5">
            <DetailField label="Transport company">{group.company.name}</DetailField>
            <DetailField label="Company status">
              <StatusIndicator
                label={companyArchived ? 'Archived' : 'Available'}
                variant={companyArchived ? 'neutral' : 'success'}
              />
            </DetailField>
            <DetailField label="Created">{formatDateTime(truck.createdAt)}</DetailField>
            <DetailField label="Last updated">{formatDateTime(truck.updatedAt)}</DetailField>
          </dl>
        </div>
        {/* Non-administrators read collections that withhold the actors; the history then says
            what happened and when, without who. */}
        <ResourceLifecycleHistory blocks={truckLifecycleBlocks(truck, administrator)} />
      </div>
      {administrator && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {status === 'suspended' && (
            <>
              <span className="mr-auto text-muted-foreground text-sm">
                Return it to service before editing or archiving it.
              </span>
              <Button onClick={() => setOpenAction('return-to-service')}>Return to service</Button>
            </>
          )}
          {status === 'available' && (
            <>
              <Button onClick={onEdit}>Edit</Button>
              <Button onClick={() => setOpenAction('suspend')} variant="outline">
                Suspend
              </Button>
              <Button
                className="ml-auto"
                onClick={() => setOpenAction('archive')}
                variant="destructive"
              >
                Archive
              </Button>
            </>
          )}
          {status === 'archived' && (
            <>
              {!canReactivate && (
                <span className="mr-auto text-muted-foreground text-sm">
                  Reactivate {group.company.name} first to reactivate this truck.
                </span>
              )}
              <Button disabled={!canReactivate} onClick={() => setOpenAction('reactivate')}>
                Reactivate
              </Button>
            </>
          )}
        </div>
      )}
      {openAction && (
        <TruckLifecycleDialog
          action={openAction}
          onClose={() => setOpenAction(null)}
          truck={truck}
        />
      )}
    </DetailRegion>
  )
}

export function CompanyDetailRow({
  group,
  administrator,
  onEdit,
  onClose,
}: {
  group: FleetGroup
  administrator: boolean
  onEdit: () => void
  onClose: () => void
}) {
  const { company, archiveBlockedBy } = group
  const archived = company.status === 'ARCHIVED'
  const [openAction, setOpenAction] = useState<LifecycleAction | null>(null)

  return (
    <DetailRegion label={`Transport company ${company.name}`} onClose={onClose}>
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-sm">{company.name}</h3>
        <StatusIndicator
          label={archived ? 'Archived' : 'Available'}
          variant={archived ? 'neutral' : 'success'}
        />
        <Button
          aria-label={`Hide details for ${company.name}`}
          className="ml-auto"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <dl className="flex flex-col gap-2.5">
          <DetailField label="Contact phone">{company.contactPhone ?? '—'}</DetailField>
          <DetailField label="Contact email">{company.contactEmail ?? '—'}</DetailField>
          <DetailField label="Created">{formatDateTime(company.createdAt)}</DetailField>
          <DetailField label="Last updated">{formatDateTime(company.updatedAt)}</DetailField>
        </dl>
        <div className="flex flex-col gap-3">
          {!archived && (
            <p className="text-muted-foreground text-sm">
              {archiveBlockedBy > 0
                ? `Can be archived once it provides no available truck (${archiveBlockedBy} today).`
                : 'Provides no available truck, so it can be archived.'}
            </p>
          )}
          {!company.archivedAt && <p className="text-muted-foreground text-sm">Never archived.</p>}
          {company.archivedAt && (
            <ResourceLifecycleHistory blocks={transportCompanyLifecycleBlocks(company)} />
          )}
        </div>
      </div>
      {administrator && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {archived ? (
            <Button onClick={() => setOpenAction('reactivate')}>Reactivate</Button>
          ) : (
            <>
              <Button onClick={onEdit}>Edit</Button>
              <Button
                className="ml-auto"
                disabled={archiveBlockedBy > 0}
                onClick={() => setOpenAction('archive')}
                variant="destructive"
              >
                Archive
              </Button>
            </>
          )}
        </div>
      )}
      {openAction && (
        <TransportCompanyLifecycleDialog
          action={openAction}
          company={company}
          onClose={() => setOpenAction(null)}
        />
      )}
    </DetailRegion>
  )
}
