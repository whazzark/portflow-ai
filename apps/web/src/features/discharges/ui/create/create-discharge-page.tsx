import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  type CreateDischargeFormValues,
  toCreateDischargeBody,
} from '@/features/discharges/discharge-preparation-schema'
import { useDischargeMutations } from '@/features/discharges/mutations/use-discharge-mutations'
import { CreateDischargeForm } from '@/features/discharges/ui/create/create-discharge-form'
import { BackToDischargesLink } from '@/features/discharges/ui/detail/back-to-discharges-link'
import {
  useCustomerOptions,
  useDockOptions,
  useResponsibleOptions,
} from '@/features/discharges/ui/preparation/preparation-options'
import { resourceSuccessMessage } from '@/helpers/resource-copy'

const createRoute = getRouteApi('/_authenticated/discharges/new')

export function CreateDischargePage() {
  const navigate = createRoute.useNavigate()
  // The form renders at once: each choice field shows its own loading or retry from these.
  const docks = useDockOptions()
  const customers = useCustomerOptions()
  const responsibles = useResponsibleOptions()
  const { create } = useDischargeMutations()
  // One identity for the life of this page: every attempt, retries included, names the same
  // creation, so the API recognizes a retry of a creation that had in fact succeeded.
  const [creationId] = useState(() => crypto.randomUUID())

  // Only a list that loaded empty stops the creation: a list still loading or failed is the
  // field's to report, and a submission without its value is refused on that field anyway.
  const missing = [
    !docks.loading && !docks.onRetry && docks.options.length === 0 && 'No available dock',
    !customers.loading &&
      !customers.onRetry &&
      customers.options.length === 0 &&
      'No available customer',
    !responsibles.loading &&
      !responsibles.onRetry &&
      responsibles.options.length === 0 &&
      'No eligible responsible',
  ].filter((reason): reason is string => Boolean(reason))

  const submit = async (values: CreateDischargeFormValues) => {
    const response = await create.mutateAsync({ body: toCreateDischargeBody(values, creationId) })

    toast.success(resourceSuccessMessage('create', 'discharge', response.data.vesselName))
    await navigate({
      to: '/discharges/$dischargeId',
      params: { dischargeId: response.data.id },
      search: (previous) => ({ ...previous, status: 'planned' as const }),
    })
  }

  return (
    // Fills the height below the header, so the form's footer rests on the bottom of the page even
    // while a step is short.
    <div className="flex flex-1 flex-col">
      <CreateDischargeForm
        customers={customers}
        disabled={missing.length > 0}
        docks={docks}
        header={
          <>
            <div className="flex flex-col gap-2">
              <BackToDischargesLink from="/discharges/new" />
              <h1 className="font-semibold text-2xl">New discharge</h1>
              <p className="text-muted-foreground text-sm">
                Prepare a vessel's discharge: the lots it unloads and the shifts that will work it.
              </p>
            </div>
            {missing.length > 0 && (
              <Alert>
                <AlertTitle>A discharge cannot be created yet</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {missing.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </>
        }
        onSubmit={submit}
        responsibles={responsibles}
      />
    </div>
  )
}
