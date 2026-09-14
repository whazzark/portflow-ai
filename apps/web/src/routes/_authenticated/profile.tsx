import { createFileRoute } from '@tanstack/react-router'

import { OwnProfilePage } from '@/features/profile/ui/own-profile-page'

// No loader: the page reads the signed-in user the `_authenticated` guard has already ensured.
export const Route = createFileRoute('/_authenticated/profile')({
  staticData: { breadcrumb: 'Profile' },
  component: OwnProfilePage,
})
