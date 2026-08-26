import type {
  BulkLifecycleBlocker,
  BulkLifecycleOutcome,
} from '@/components/lifecycle/bulk-resource-lifecycle-actions'
import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import {
  ResourceLifecycleActions,
  type ResourceLifecycleConfig,
  ResourceLifecycleDialog,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useCustomerMutations } from '@/features/customers/mutations/use-customer-mutations'
import type { BulkCustomerLifecycleResult, CustomerDto } from '@/features/customers/types'

export const CUSTOMER_SINGULAR = 'customer'
export const CUSTOMER_PLURAL = 'customers'

export function customerLifecycleActions(status: CustomerDto['status']): LifecycleAction[] {
  return status === 'ARCHIVED' ? ['reactivate'] : ['archive']
}

/** Every lifecycle transition this record carries, for its detail pane. The summary
 * orders them and drops the ones that never happened. */
export function customerLifecycleBlocks(customer: CustomerDto): LifecycleBlock[] {
  return [
    {
      action: 'archive',
      at: customer.archivedAt,
      actor: customer.archivedBy,
      comment: customer.archiveComment,
    },
    {
      action: 'reactivate',
      at: customer.reactivatedAt,
      actor: customer.reactivatedBy,
      comment: customer.reactivationComment,
    },
  ]
}

export function useCustomerLifecycleConfig(customer: CustomerDto): ResourceLifecycleConfig {
  const mutations = useCustomerMutations()

  return {
    singular: CUSTOMER_SINGULAR,
    name: customer.companyName,
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshCustomers,
    submit: (action, body) =>
      action === 'reactivate'
        ? mutations.reactivate.mutateAsync({ params: { id: customer.id }, body })
        : mutations.archive.mutateAsync({ params: { id: customer.id }, body }),
  }
}

/** The confirmation on its own, for the row menus: it owns the mutation hooks so a directory row
 * runs none of them until an administrator actually opens a confirmation. */
export function CustomerLifecycleDialog({
  action,
  customer,
  onClose,
}: {
  action: LifecycleAction
  customer: CustomerDto
  onClose: () => void
}) {
  const config = useCustomerLifecycleConfig(customer)

  return <ResourceLifecycleDialog action={action} config={config} onClose={onClose} />
}

export function CustomerLifecycleActions({
  className,
  customer,
}: {
  className?: string
  customer: CustomerDto
}) {
  const config = useCustomerLifecycleConfig(customer)

  return (
    <ResourceLifecycleActions
      actions={customerLifecycleActions(customer.status)}
      className={className}
      config={config}
    />
  )
}

export function toBulkCustomerLifecycleOutcome(
  result: BulkCustomerLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedCustomers.length,
    blocked: result.blockedCustomers.map(
      (blocked): BulkLifecycleBlocker => ({
        id: blocked.id,
        // The code is what the administrator sees in the directory; the id is the last resort.
        name: blocked.code ?? undefined,
        reason: blocked.reason,
      }),
    ),
  }
}
