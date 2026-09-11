import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { userQueries } from '@/features/users/queries/user-queries'
import { UsersError } from '@/features/users/ui/users-error'
import { UsersPage } from '@/features/users/ui/users-page'
import { UsersPending } from '@/features/users/ui/users-pending'

const userSearchSchema = z
  .object({
    search: z.string().catch(''),
    status: z.enum(['active', 'pending', 'deactivated', 'cancelled']).catch('active'),
    role: z
      .enum(['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER', 'all'])
      .catch('all'),
    sort: z.enum(['name', 'role']).catch('name'),
    order: z.enum(['asc', 'desc']).catch('asc'),
    userId: z.string().optional().catch(undefined),
    mode: z.enum(['create']).optional().catch(undefined),
    /**
     * The user an invitation has just created. It outlives the invitation panel: once the link is
     * acknowledged, it is what puts the new pending user in front of the administrator.
     */
    invitedUserId: z.string().optional().catch(undefined),
  })
  .transform((search) =>
    // An open record and an invitation in progress cannot both be armed: the creation clears the
    // record, so no consumer has to decide which of the two wins.
    search.mode === 'create' ? { ...search, userId: undefined } : search,
  )

export const Route = createFileRoute('/_authenticated/users')({
  staticData: { breadcrumb: 'Users' },
  validateSearch: userSearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(userQueries.list()),
  pendingComponent: UsersPending,
  errorComponent: UsersError,
  component: UsersPage,
})
