import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { userQueries } from '@/features/users/queries/user-queries'
import { UsersError } from '@/features/users/ui/users-error'
import { UsersPage } from '@/features/users/ui/users-page'
import { UsersPending } from '@/features/users/ui/users-pending'

const userSearchSchema = z.object({
  search: z.string().catch(''),
  status: z.enum(['active', 'pending', 'deactivated', 'cancelled']).catch('active'),
  role: z
    .enum(['ORGANIZATION_ADMIN', 'OPERATIONS_ADMIN', 'OPERATIONS_LEAD', 'OBSERVER', 'all'])
    .catch('all'),
  sort: z.enum(['name', 'role']).catch('name'),
  order: z.enum(['asc', 'desc']).catch('asc'),
  userId: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/users')({
  staticData: { breadcrumb: 'Users' },
  validateSearch: userSearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(userQueries.list()),
  pendingComponent: UsersPending,
  errorComponent: UsersError,
  component: UsersPage,
})
