import type { LifecycleAction } from '@/components/lifecycle/lifecycle-copy'
import {
  type ResourceLifecycleConfig,
  ResourceLifecycleDialog,
} from '@/components/lifecycle/resource-lifecycle-actions'
import type { LifecycleBlock } from '@/components/lifecycle/resource-lifecycle-summary'
import { useTransportCompanyMutations } from '@/features/transport-companies/mutations/use-transport-company-mutations'
import type { TransportCompanyDto } from '@/features/transport-companies/types'

export const TRANSPORT_COMPANY_SINGULAR = 'transport company'

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
