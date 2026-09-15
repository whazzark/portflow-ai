import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useBulkSelection } from '@/components/lifecycle/use-bulk-selection'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { InputSearch } from '@/components/ui/input-search'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import { type TruckRefusals, truckRefusals } from '@/features/discharges/truck-pool-refusals'
import { candidateMatchesSearch } from '@/features/discharges/truck-pool-selection'
import type { DischargeDetailDto, TruckCandidateDto } from '@/features/discharges/types'
import { STARTED_REFUSAL_MESSAGE } from '@/features/discharges/ui/detail/edit-discharge-identity-sheet'
import { TruckHoldings } from '@/features/discharges/ui/detail/truck-holdings'
import { parseApiError } from '@/libraries/tuyau/api-error'

type AddTrucksSheetProps = {
  discharge: DischargeDetailDto
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddTrucksSheet({ discharge, open, onOpenChange }: AddTrucksSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto" size="lg">
        <SheetHeader>
          <SheetTitle>Add trucks</SheetTitle>
          <SheetDescription>
            Reserve trucks for {discharge.vesselName}. A truck held by another discharge can still
            be reserved; the conflict is settled when a discharge starts.
          </SheetDescription>
        </SheetHeader>
        {open && <AddTrucksForm discharge={discharge} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}

function reservedMessage(count: number) {
  return count === 1 ? 'Truck reserved' : `${count} trucks reserved`
}

function AddTrucksForm({
  discharge,
  onDone,
}: {
  discharge: DischargeDetailDto
  onDone: () => void
}) {
  const searchId = useId()
  const { reserveTrucks } = useDischargeMutations()
  const candidatesQuery = useQuery(dischargeQueries.truckCandidates(discharge.id))
  const selection = useBulkSelection()
  const [search, setSearch] = useState('')
  const [refusals, setRefusals] = useState<TruckRefusals | null>(null)
  const refusalAlert = useRef<HTMLDivElement>(null)
  // The pending state reaches the button a render later; two presses in that gap send one request.
  const submitting = useRef(false)
  // A refused truck may drop out of the refreshed candidates; it stays listed, checked, until the
  // user unchecks it, so the reason is never shown against nothing.
  const [remembered, setRemembered] = useState<Map<string, TruckCandidateDto>>(new Map())

  useEffect(() => {
    if (refusals) {
      refusalAlert.current?.focus()
    }
  }, [refusals])

  const candidates = useMemo(() => {
    const loaded = candidatesQuery.data?.data ?? []
    const loadedIds = new Set(loaded.map((candidate) => candidate.id))
    const kept = [...remembered.values()].filter(
      (candidate) => !loadedIds.has(candidate.id) && selection.selectedIds.has(candidate.id),
    )

    return [...loaded, ...kept]
  }, [candidatesQuery.data, remembered, selection.selectedIds])

  const visible = candidates.filter((candidate) => candidateMatchesSearch(candidate, search))
  const visibleIds = visible.map((candidate) => candidate.id)
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selection.selectedIds.has(id))
  const someVisibleSelected = visibleIds.some((id) => selection.selectedIds.has(id))
  const selectedIds = candidates
    .map((candidate) => candidate.id)
    .filter((id) => selection.selectedIds.has(id))

  const submit = async () => {
    if (submitting.current || selectedIds.length === 0) {
      return
    }
    submitting.current = true

    setRemembered(new Map(candidates.map((candidate) => [candidate.id, candidate])))
    try {
      await reserveTrucks.mutateAsync({
        params: { dischargeId: discharge.id },
        body: { truckIds: selectedIds },
      })
      toast.success(reservedMessage(selectedIds.length))
      onDone()
    } catch (error) {
      const apiError = parseApiError(error)
      const refused = truckRefusals(apiError, selectedIds)

      if (refused) {
        setRefusals(refused)
        return
      }
      if (
        apiError.code === 'E_DISCHARGE_NOT_PLANNED' ||
        apiError.code === 'E_DISCHARGE_NOT_FOUND'
      ) {
        toast.error(STARTED_REFUSAL_MESSAGE)
        onDone()
        return
      }

      toast.error('Unable to reserve trucks', { description: apiError.message })
    } finally {
      submitting.current = false
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      {refusals && (
        <Alert ref={refusalAlert} tabIndex={-1} variant="destructive">
          <AlertDescription>
            <p>Some trucks can no longer be reserved</p>
            {refusals.summary.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
      {candidatesQuery.isPending ? (
        <div aria-label="Loading trucks" className="grid gap-2" role="status">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : candidatesQuery.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>Unable to load trucks</span>
            <Button onClick={() => void candidatesQuery.refetch()} size="sm" variant="outline">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : candidates.length === 0 ? (
        <Empty className="border-0 p-0">
          <EmptyHeader>
            <EmptyTitle>No trucks to add</EmptyTitle>
            <EmptyDescription>Every available truck is already in this pool.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <InputSearch
            id={searchId}
            label="Search trucks"
            onValueChange={setSearch}
            placeholder="Search by registration or transport company"
            value={search}
          />
          {visible.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 border-b pb-2">
                <Checkbox
                  aria-checked={
                    someVisibleSelected && !allVisibleSelected ? 'mixed' : allVisibleSelected
                  }
                  aria-label="Select all"
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => selection.toggleMany(visibleIds, checked === true)}
                />
                <span className="text-muted-foreground text-xs">Select all</span>
              </div>
              <ul aria-label="Trucks to add" className="grid gap-1">
                {visible.map((candidate) => {
                  const reason = refusals?.byTruck.get(candidate.id)
                  const reasonId = `${searchId}-${candidate.id}-reason`

                  return (
                    <li className="flex items-start gap-3 rounded-lg px-2 py-2" key={candidate.id}>
                      <Checkbox
                        aria-describedby={reason ? reasonId : undefined}
                        aria-label={`Select ${candidate.registration}`}
                        checked={selection.selectedIds.has(candidate.id)}
                        className="mt-0.5"
                        onCheckedChange={() => selection.toggle(candidate.id)}
                      />
                      <div className="grid min-w-0 gap-0.5">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="font-medium">{candidate.registration}</span>
                          <TruckHoldings holdings={candidate.otherHoldings} />
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {candidate.transportCompany.name}
                        </span>
                        {reason && (
                          <span className="text-destructive text-sm" id={reasonId}>
                            {reason}
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No trucks match “{search}”</p>
          )}
          <p className="text-muted-foreground text-sm">{selectedIds.length} selected</p>
        </>
      )}
      <SheetFooter className="flex-row justify-end gap-2 p-0">
        <Button onClick={onDone} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={selectedIds.length === 0 || reserveTrucks.isPending}
          onClick={() => void submit()}
          type="button"
        >
          {reserveTrucks.isPending ? 'Reserving…' : 'Reserve'}
        </Button>
      </SheetFooter>
    </div>
  )
}
