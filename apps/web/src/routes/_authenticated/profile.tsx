import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { OwnProfilePage } from '@/features/profile/ui/own-profile-page'

const profileSearchSchema = z.object({
  tab: z.enum(['identity', 'password']).catch('identity'),
})

// No loader: the page reads the signed-in user the `_authenticated` guard has already ensured.
export const Route = createFileRoute('/_authenticated/profile')({
  staticData: { breadcrumb: 'Profile' },
  validateSearch: profileSearchSchema,
  component: OwnProfilePage,
})
