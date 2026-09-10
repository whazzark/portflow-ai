import { ResourceLifecycleSummary } from '@/components/lifecycle/resource-lifecycle-summary'
import {
  RESOURCE_STATUS_LABELS,
  ResourceDetailBody,
  ResourceDetailField,
  ResourceDetailHeader,
} from '@/components/resource/resource-details'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SheetFooter } from '@/components/ui/sheet'
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
    <div className="flex min-h-0 flex-1 flex-col">
      <ResourceDetailHeader
        archivedMessage="Archived transport companies cannot receive new operations."
        name={company.name}
        status={company.status}
      />
      <ResourceDetailBody>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <ResourceDetailField label="Current company name" value={company.name} />
          <ResourceDetailField label="Status" value={RESOURCE_STATUS_LABELS[company.status]} />
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
      </ResourceDetailBody>
      {canAdminister && (
        <SheetFooter className="shrink-0 border-t bg-popover sm:flex-row sm:items-center sm:justify-between">
          {!isArchived && <Button onClick={onEdit}>Edit</Button>}
          <TransportCompanyLifecycleActions
            className="sm:ml-auto"
            company={company}
            onSuccess={onLifecycleSuccess}
          />
        </SheetFooter>
      )}
    </div>
  )
}
