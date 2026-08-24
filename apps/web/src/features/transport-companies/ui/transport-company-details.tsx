import { ResourceDetailField } from '@/components/resource-map/resource-details'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { TransportCompanyLifecycleActions } from '@/features/transport-companies/ui/transport-company-lifecycle-actions'
import { formatFullName } from '@/features/users/helpers/name'
import { formatDateTime } from '@/helpers/dates'

type TransportCompanyDetailsProps = {
  canAdminister: boolean
  company: TransportCompanyDto
  onArchiveSuccess?: () => void
  onEdit: () => void
}

export function TransportCompanyDetails({
  canAdminister,
  company,
  onArchiveSuccess,
  onEdit,
}: TransportCompanyDetailsProps) {
  const isArchived = company.status === 'ARCHIVED'
  const lifecycleTime = isArchived ? company.archivedAt : company.reactivatedAt
  const lifecycleActor = isArchived ? company.archivedBy : company.reactivatedBy
  const lifecycleComment = isArchived ? company.archiveComment : company.reactivationComment

  return (
    <section aria-label="Transport company details" className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-5 py-4 md:px-6">
        <h2 className="font-heading font-semibold text-xl">{company.name}</h2>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={isArchived ? 'outline' : 'secondary'}>
            {isArchived ? 'Archived' : 'Available'}
          </Badge>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-6">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <ResourceDetailField label="Current company name" value={company.name} />
          <ResourceDetailField label="Status" value={isArchived ? 'Archived' : 'Available'} />
          <ResourceDetailField label="Created" value={formatDateTime(company.createdAt)} />
          <ResourceDetailField label="Last updated" value={formatDateTime(company.updatedAt)} />
        </dl>
        <Separator className="my-6" />
        <section
          aria-labelledby="transport-company-lifecycle-heading"
          className="flex flex-col gap-3"
        >
          <h3 className="font-medium" id="transport-company-lifecycle-heading">
            {isArchived ? 'Archive context' : 'Latest reactivation context'}
          </h3>
          <dl className="grid gap-4 text-sm">
            <ResourceDetailField
              label={isArchived ? 'Archived at' : 'Reactivated at'}
              value={lifecycleTime ? formatDateTime(lifecycleTime) : null}
            />
            <ResourceDetailField
              label={isArchived ? 'Archived by' : 'Reactivated by'}
              value={lifecycleActor ? formatFullName(lifecycleActor) : null}
            />
            <ResourceDetailField label="Comment" value={lifecycleComment} />
          </dl>
        </section>
      </div>
      {canAdminister && !isArchived && (
        <footer className="flex shrink-0 gap-2 border-t bg-popover px-5 py-4 md:px-6">
          <Button onClick={onEdit}>Edit company</Button>
          <TransportCompanyLifecycleActions company={company} onSuccess={onArchiveSuccess} />
        </footer>
      )}
    </section>
  )
}
