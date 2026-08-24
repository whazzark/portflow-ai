import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import type { TruckDto } from '@/features/trucks/types'
import { type CreateTruckValue, TruckForm } from '@/features/trucks/ui/truck-form'

type CreateTruckPanelProps = {
  companies: Array<Pick<TransportCompanyDto, 'id' | 'name'>> | undefined
  companiesError: boolean
  onRetryCompanies: () => void
  onCreate: (value: CreateTruckValue) => Promise<TruckDto>
  onSuccess: (truck: TruckDto) => void
}

export function CreateTruckPanel({
  companies,
  companiesError,
  onRetryCompanies,
  onCreate,
  onSuccess,
}: CreateTruckPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create truck</SheetTitle>
        <SheetDescription>
          Register a truck for one of the site's transport companies.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <CreateTruckContent
          companies={companies}
          companiesError={companiesError}
          onCreate={onCreate}
          onRetryCompanies={onRetryCompanies}
          onSuccess={onSuccess}
        />
      </div>
    </div>
  )
}

function CreateTruckContent({
  companies,
  companiesError,
  onRetryCompanies,
  onCreate,
  onSuccess,
}: CreateTruckPanelProps) {
  if (companiesError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load transport companies</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <span>A truck cannot be created until the company list is available. Try again.</span>
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

  if (companies.length === 0) {
    return (
      <Alert>
        <AlertTitle>No available transport company</AlertTitle>
        <AlertDescription>
          A truck can only be created for an available transport company. Reactivate one first.
        </AlertDescription>
      </Alert>
    )
  }

  return <TruckForm companies={companies} onCreate={onCreate} onSuccess={onSuccess} />
}
