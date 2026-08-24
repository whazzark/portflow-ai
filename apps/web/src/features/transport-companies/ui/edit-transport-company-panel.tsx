import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { TransportCompanyForm } from '@/features/transport-companies/ui/transport-company-form'

type EditTransportCompanyPanelProps = {
  company: TransportCompanyDto
  onCancel: () => void
  onUpdate: (value: { name: string }) => Promise<TransportCompanyDto>
  onSuccess: (company: TransportCompanyDto) => void
}

export function EditTransportCompanyPanel({
  company,
  onCancel,
  onUpdate,
  onSuccess,
}: EditTransportCompanyPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <Button className="self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to company details
        </Button>
        <SheetTitle>Edit transport company</SheetTitle>
        <SheetDescription>Update the current company name for {company.name}.</SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <TransportCompanyForm
          company={company}
          onCreate={() => {
            throw new Error('Creation is not available while editing')
          }}
          onSuccess={onSuccess}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  )
}
