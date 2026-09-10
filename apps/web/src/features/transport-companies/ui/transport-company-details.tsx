import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import { ResourceDetailField } from '@/components/resource/resource-details'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  TransportCompanyLifecycleActions,
  transportCompanyLifecycleBlocks,
} from '@/features/transport-companies/transport-company-lifecycle'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { formatDateTime } from '@/helpers/dates'

type TransportCompanyDetailsProps = {
  canAdminister: boolean
  company: TransportCompanyDto
  onLifecycleSuccess?: () => void
  onEdit: () => void
}

export function TransportCompanyDetails({
  canAdminister,
  company,
  onLifecycleSuccess,
  onEdit,
}: TransportCompanyDetailsProps) {
  const isArchived = company.status === 'ARCHIVED'
  const lifecycleBlocks = transportCompanyLifecycleBlocks(company)

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
          aria-labelledby="transport-company-contact-heading"
          className="flex flex-col gap-3"
        >
          <h3 className="font-medium" id="transport-company-contact-heading">
            Contact
          </h3>
          {company.contactPhone && company.contactEmail ? (
            <dl className="grid gap-5 text-sm sm:grid-cols-2">
              <ResourceDetailField label="Contact phone" value={company.contactPhone} />
              <ResourceDetailField label="Contact email" value={company.contactEmail} />
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">No contact details recorded</p>
          )}
        </section>
        {lifecycleBlocks.some((block) => block.at) && <Separator className="my-6" />}
        <ResourceLifecycleSummary blocks={lifecycleBlocks} />
      </div>
      {canAdminister && (
        <footer className="flex shrink-0 gap-2 border-t bg-popover px-5 py-4 md:px-6">
          {!isArchived && <Button onClick={onEdit}>Edit</Button>}
          <TransportCompanyLifecycleActions company={company} onSuccess={onLifecycleSuccess} />
        </footer>
      )}
    </section>
  )
}
