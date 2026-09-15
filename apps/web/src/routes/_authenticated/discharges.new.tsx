import { createFileRoute, redirect } from '@tanstack/react-router'

import { canPrepareDischarges } from '@/features/discharges/discharge-permissions'
import { CreateDischargePage } from '@/features/discharges/ui/create/create-discharge-page'
import { CreateDischargePending } from '@/features/discharges/ui/create/create-discharge-pending'
import { ensureSessionUser } from '@/libraries/tuyau/session'

export const Route = createFileRoute('/_authenticated/discharges/new')({
  staticData: { breadcrumb: 'New discharge' },
  beforeLoad: async ({ context: { queryClient }, search }) => {
    const { data: user } = await ensureSessionUser(queryClient)

    // A viewer who may not prepare discharges goes back to the list they came from rather than to
    // a form the API would refuse. The API stays the authority: this only spares the detour.
    if (!canPrepareDischarges(user)) {
      throw redirect({ to: '/discharges', search, replace: true })
    }
  },
  pendingComponent: CreateDischargePending,
  component: CreateDischargePage,
})
