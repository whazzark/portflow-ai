import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { customerQueries } from '@/features/customers/queries/customer-queries'
import { CustomersError } from '@/features/customers/ui/customers-error'
import { CustomersPage } from '@/features/customers/ui/customers-page'
import { CustomersPending } from '@/features/customers/ui/customers-pending'

const customerSearchSchema = z
  .object({
    search: z.string().catch(''),
    status: z.enum(['available', 'archived']).catch('available'),
    customerId: z.string().optional().catch(undefined),
    mode: z.enum(['create', 'edit', 'view']).optional().catch(undefined),
    availableSort: z.enum(['code', 'companyName', 'reactivationComment']).catch('code'),
    availableOrder: z.enum(['asc', 'desc']).catch('asc'),
    archivedSort: z.enum(['code', 'companyName', 'archiveComment']).catch('code'),
    archivedOrder: z.enum(['asc', 'desc']).catch('asc'),
  })
  .transform((search) => {
    if (search.mode === 'create') {
      return { ...search, customerId: undefined }
    }

    if ((search.mode === 'edit' || search.mode === 'view') && !search.customerId) {
      return { ...search, mode: undefined }
    }

    return search
  })

export const Route = createFileRoute('/_authenticated/customers')({
  staticData: { breadcrumb: 'Customers' },
  validateSearch: (search: Record<string, unknown>) => customerSearchSchema.parse(search),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(customerQueries.list()),
  pendingComponent: CustomersPending,
  errorComponent: CustomersError,
  component: CustomersPage,
})
