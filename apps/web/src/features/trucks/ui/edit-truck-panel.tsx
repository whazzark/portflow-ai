import { ArrowLeftIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { TruckForm, type UpdateTruckValue } from '@/features/trucks/ui/truck-form'

type EditTruckPanelProps = {
  truck: TruckDto
  companies: Array<Pick<TransportCompanyDto, 'id' | 'name'>> | undefined
  companiesError: boolean
  onRetryCompanies: () => void
  onCancel: () => void
  onUpdate: (value: UpdateTruckValue) => Promise<TruckDto>
  onSuccess: (truck: TruckDto) => void
}

export function EditTruckPanel({
  truck,
  companies,
  companiesError,
  onRetryCompanies,
  onCancel,
  onUpdate,
  onSuccess,
}: EditTruckPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to truck details
        </Button>
        <SheetTitle>Edit truck</SheetTitle>
        <SheetDescription>Update {truck.registration}'s information and provider.</SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <EditTruckContent
          companies={companies}
          companiesError={companiesError}
          onRetryCompanies={onRetryCompanies}
          onSuccess={onSuccess}
          onUpdate={onUpdate}
          truck={truck}
        />
      </div>
    </div>
  )
}

function EditTruckContent({
  truck,
  companies,
  companiesError,
  onRetryCompanies,
  onUpdate,
  onSuccess,
}: Omit<EditTruckPanelProps, 'onCancel'>) {
  if (companiesError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load transport companies</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>A truck cannot be updated until the company list is available. Try again.</span>
          <Button onClick={onRetryCompanies} variant="outline">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!companies) {
    return <p className="text-muted-foreground text-sm">Loading transport companies…</p>
  }

  return (
    <TruckForm
      companies={companies}
      onCreate={() => {
        throw new Error('Create is not available while editing')
      }}
      onSuccess={onSuccess}
      onUpdate={onUpdate}
      truck={truck}
    />
  )
}
