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
import { useTransportCompanyMutations } from '@/features/transport-companies/mutations/use-transport-company-mutations'
import type {
  BulkTransportCompanyLifecycleResult,
  TransportCompanyDto,
} from '@/features/transport-companies/types'

export const TRANSPORT_COMPANY_SINGULAR = 'transport company'
export const TRANSPORT_COMPANY_PLURAL = 'transport companies'

/** A company that still provides available trucks cannot be archived; the API refuses it and the
 * bulk toolbar names that reason, so the button stays offered rather than silently disappearing. */
export const TRANSPORT_COMPANY_BLOCKER_REASON_LABELS = {
  HAS_AVAILABLE_TRUCKS: 'still provides available trucks',
}

export function transportCompanyLifecycleActions(
  status: TransportCompanyDto['status'],
): LifecycleAction[] {
  return status === 'ARCHIVED' ? ['reactivate'] : ['archive']
}

/** Every lifecycle transition this record carries, for its detail pane. The summary
 * orders them and drops the ones that never happened. */
export function transportCompanyLifecycleBlocks(company: TransportCompanyDto): LifecycleBlock[] {
  return [
    {
      action: 'archive',
      at: company.archivedAt,
      actor: company.archivedBy,
      comment: company.archiveComment,
    },
    {
      action: 'reactivate',
      at: company.reactivatedAt,
      actor: company.reactivatedBy,
      comment: company.reactivationComment,
    },
  ]
}

export function useTransportCompanyLifecycleConfig(
  company: TransportCompanyDto,
  onSuccess?: () => void,
): ResourceLifecycleConfig {
  const mutations = useTransportCompanyMutations()

  return {
    singular: TRANSPORT_COMPANY_SINGULAR,
    name: company.name,
    isPending: mutations.archive.isPending || mutations.reactivate.isPending,
    refresh: mutations.refreshTransportCompanies,
    submit: async (action, body) => {
      const result =
        action === 'reactivate'
          ? await mutations.reactivate.mutateAsync({ params: { id: company.id }, body })
          : await mutations.archive.mutateAsync({ params: { id: company.id }, body })

      // The workspace closes its detail sheet once the company has left the collection the sheet
      // was opened from.
      onSuccess?.()

      return result
    },
  }
}

/** The confirmation on its own, for the row menus: it owns the mutation hooks so a directory row
 * runs none of them until an administrator actually opens a confirmation. */
export function TransportCompanyLifecycleDialog({
  action,
  company,
  onClose,
}: {
  action: LifecycleAction
  company: TransportCompanyDto
  onClose: () => void
}) {
  const config = useTransportCompanyLifecycleConfig(company)

  return <ResourceLifecycleDialog action={action} config={config} onClose={onClose} />
}

export function TransportCompanyLifecycleActions({
  className,
  company,
  onSuccess,
}: {
  className?: string
  company: TransportCompanyDto
  onSuccess?: () => void
}) {
  const config = useTransportCompanyLifecycleConfig(company, onSuccess)

  return (
    <ResourceLifecycleActions
      actions={transportCompanyLifecycleActions(company.status)}
      className={className}
      config={config}
    />
  )
}

export function toBulkTransportCompanyLifecycleOutcome(
  result: BulkTransportCompanyLifecycleResult,
): BulkLifecycleOutcome {
  return {
    updatedCount: result.updatedCompanies.length,
    blocked: result.blockedCompanies.map(
      (blocked): BulkLifecycleBlocker => ({
        id: blocked.id,
        name: blocked.name ?? undefined,
        reason: blocked.reason,
      }),
    ),
  }
}
