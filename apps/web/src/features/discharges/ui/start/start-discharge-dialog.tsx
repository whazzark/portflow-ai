import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { startReview } from '@/features/discharges/discharge-start-view'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { dischargeQueries } from '@/features/discharges/queries/discharge-queries'
import type { DischargeDetailDto, StartRefusedMeta } from '@/features/discharges/types'
import { PLANNING_CONFLICT_MESSAGE } from '@/features/discharges/ui/planning/planning-refusals'
import { StartProblems } from '@/features/discharges/ui/start/start-problems'
import { StartReviewContent } from '@/features/discharges/ui/start/start-review'
import { parseApiError } from '@/libraries/tuyau/api-error'

type StartDischargeDialogProps = {
  discharge: DischargeDetailDto
  onClose: () => void
  /** Called once the discharge started, after the dialog closed. */
  onStarted: () => void
}

/**
 * Answers that end the confirmation: the discharge started or disappeared meanwhile, or the user may
 * no longer start discharges. The detail behind is refreshed by the mutation or invalidated here.
 */
const CLOSING_MESSAGES: Record<string, string> = {
  E_DISCHARGE_NOT_PLANNED: 'This discharge has already started',
  E_DISCHARGE_NOT_FOUND: 'This discharge has already started',
  E_AUTHORIZATION_FAILURE: 'You are not allowed to start discharges',
}

/**
 * The Discharge Start Confirmation. It reviews the preparation from the detail on screen and asks
 * the API what a start would answer now. While problems are listed the confirmation is unavailable,
 * and the review folds away behind them; the API still decides again when the user confirms, since
 * the plan and the other discharges may change in between. Mounted only while open.
 */
export function StartDischargeDialog({ discharge, onClose, onStarted }: StartDischargeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const check = useQuery(dischargeQueries.startCheck(discharge.id))
  const { start } = useDischargeMutations()
  const [refusals, setRefusals] = useState(0)
  const [failed, setFailed] = useState(false)
  const review = startReview(discharge, check.data?.data.shiftId ?? null)
  const problems = check.data?.data.problems ?? []
  const checkCode = check.error ? parseApiError(check.error).code : null
  const closingCheck = checkCode ? CLOSING_MESSAGES[checkCode] : undefined
  // A start the API would refuse is not offered: the user fixes the problems, then opens it again.
  const blocked = check.isSuccess && problems.length > 0

  // A refusal replaces the list; moving focus to it tells a keyboard or screen reader user why.
  useEffect(() => {
    if (refusals > 0) {
      alertRef.current?.focus()
    }
  }, [refusals])

  useEffect(() => {
    if (closingCheck) {
      toast.error(closingCheck)
      void queryClient.invalidateQueries({
        queryKey: dischargeQueries.detail(discharge.id).queryKey,
      })
      onClose()
    }
  }, [closingCheck, discharge.id, onClose, queryClient])

  const confirm = async () => {
    setFailed(false)
    let response: Awaited<ReturnType<typeof start.mutateAsync>>

    try {
      response = await start.mutateAsync({ params: { id: discharge.id } })
    } catch (cause) {
      const error = parseApiError(cause)
      const closing = CLOSING_MESSAGES[error.code]

      if (error.code === 'E_DISCHARGE_START_REFUSED') {
        // The start was decided on the plan as it stood then: its list replaces the check's.
        const meta = error.meta as StartRefusedMeta
        queryClient.setQueryData(dischargeQueries.startCheck(discharge.id).queryKey, {
          data: { dischargeId: discharge.id, shiftId: meta.shiftId, problems: meta.problems },
        })
        setRefusals((count) => count + 1)
      } else if (closing) {
        toast.error(closing)
        onClose()
      } else if (error.code === 'E_DISCHARGE_PLANNING_CONFLICT') {
        toast.error(PLANNING_CONFLICT_MESSAGE)
        await check.refetch()
      } else {
        setFailed(true)
      }

      return
    }

    const [shift] = response.data.shifts.filter((candidate) => candidate.status === 'ACTIVE')

    onClose()
    onStarted()
    toast.success('Discharge started', {
      description: shift
        ? `${response.data.vesselName} · shift ${startReview(response.data, shift.id).shift?.label}`
        : response.data.vesselName,
    })
  }

  return (
    <Dialog onOpenChange={(open) => !open && !start.isPending && onClose()} open={true}>
      <DialogContent initialFocus={cancelRef} showCloseButton={!start.isPending} size="xl">
        <DialogHeader>
          <DialogTitle>Start {discharge.vesselName}</DialogTitle>
          <DialogDescription>
            {blocked
              ? 'Fix these problems where they are planned, then start again.'
              : "The discharge and its first shift become active now, and the shift's actual start is recorded as this moment."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto">
          {check.isPending && <Skeleton aria-label="Checking the discharge" className="h-5 w-64" />}
          {check.isError && !closingCheck && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>Unable to check this discharge.</span>
                <Button
                  disabled={check.isFetching}
                  onClick={() => void check.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {blocked ? (
            <>
              <StartProblems
                alertRef={alertRef}
                discharge={discharge}
                onNavigate={onClose}
                problems={problems}
              />
              <details className="rounded-lg border px-3 py-2">
                <summary className="cursor-pointer font-medium">Preparation to start</summary>
                <div className="pt-3">
                  <StartReviewContent checking={false} discharge={discharge} review={review} />
                </div>
              </details>
            </>
          ) : (
            <StartReviewContent checking={!check.isSuccess} discharge={discharge} review={review} />
          )}
        </div>
        {failed && (
          <p className="text-destructive" role="alert">
            Unable to start this discharge. Try again.
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={start.isPending}
            onClick={onClose}
            ref={cancelRef}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!check.isSuccess || blocked || start.isPending}
            onClick={() => void confirm()}
            type="button"
          >
            {start.isPending ? 'Starting…' : 'Start discharge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
