import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { customerQueries } from '@/features/customers/queries/customer-queries'
import { CustomersError } from '@/features/customers/ui/customers-error'
import { CustomersPage } from '@/features/customers/ui/customers-page'
import { CustomersPending } from '@/features/customers/ui/customers-pending'

const customerSearchSchema = z.object({
  q: z.string().catch(''),
  status: z.enum(['available', 'archived']).catch('available'),
  customerId: z.string().optional().catch(undefined),
  mode: z.enum(['create', 'edit', 'view']).optional().catch(undefined),
  availableSort: z.enum(['code', 'companyName', 'updatedAt']).catch('code'),
  availableOrder: z.enum(['asc', 'desc']).catch('asc'),
  archivedSort: z.enum(['code', 'companyName', 'updatedAt']).catch('code'),
  archivedOrder: z.enum(['asc', 'desc']).catch('asc'),
})

export const Route = createFileRoute('/_authenticated/customers')({
  staticData: { breadcrumb: 'Customers' },
  validateSearch: (search: Record<string, unknown>) => customerSearchSchema.parse(search),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(customerQueries.list()),
  pendingComponent: CustomersPending,
  errorComponent: CustomersError,
  component: CustomersPage,
})
