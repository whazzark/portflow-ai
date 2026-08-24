import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { type CreateTruckValue, TruckForm } from '@/features/trucks/ui/truck-form'

type CreateTruckPanelProps = {
  companies: Array<Pick<TransportCompanyDto, 'id' | 'name'>>
  onCreate: (value: CreateTruckValue) => Promise<TruckDto>
  onSuccess: (truck: TruckDto) => void
}

export function CreateTruckPanel({ companies, onCreate, onSuccess }: CreateTruckPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create truck</SheetTitle>
        <SheetDescription>
          Register a truck for one of the site's transport companies.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <TruckForm companies={companies} onCreate={onCreate} onSuccess={onSuccess} />
      </div>
    </div>
  )
}
