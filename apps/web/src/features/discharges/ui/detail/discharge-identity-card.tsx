import { ResourceDetailField } from '@/components/resource/resource-details'
import { formatTonnes } from '@/features/discharges/discharge-detail-view'
import type { DischargeDetailDto } from '@/features/discharges/types'
import { DetailSection } from '@/features/discharges/ui/detail/detail-section'
import { ReferenceLabel } from '@/features/discharges/ui/detail/reference-label'
import { formatDateTime } from '@/helpers/dates'

type DischargeIdentityCardProps = {
  discharge: DischargeDetailDto
}

export function DischargeIdentityCard({ discharge }: DischargeIdentityCardProps) {
  return (
    <DetailSection title="Overview">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ResourceDetailField label="IMO" value={discharge.vesselImo} />
        <div className="grid gap-1">
          <dt className="text-muted-foreground">Dock</dt>
          <dd>
            <ReferenceLabel name={discharge.dock.name} status={discharge.dock.status} />
          </dd>
        </div>
        <ResourceDetailField
          label="Expected start"
          value={formatDateTime(discharge.expectedStartAt)}
        />
        <ResourceDetailField
          label="Expected tonnage"
          value={formatTonnes(discharge.expectedTonnage)}
        />
        <div className="sm:col-span-2">
          <ResourceDetailField label="Vessel comment" value={discharge.vesselComment} />
        </div>
      </dl>
    </DetailSection>
  )
}
