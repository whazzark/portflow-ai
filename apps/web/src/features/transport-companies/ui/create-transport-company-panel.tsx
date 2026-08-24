import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import {
  TransportCompanyForm,
  type TransportCompanyFormValue,
} from '@/features/transport-companies/ui/transport-company-form'

type CreateTransportCompanyPanelProps = {
  onCreate: (value: TransportCompanyFormValue) => Promise<TransportCompanyDto>
  onSuccess: (company: TransportCompanyDto) => void
}

export function CreateTransportCompanyPanel({
  onCreate,
  onSuccess,
}: CreateTransportCompanyPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Create transport company</SheetTitle>
        <SheetDescription>
          Add a reusable transport company reference for the site, with how to reach it.
        </SheetDescription>
      </SheetHeader>
      <div className="px-4">
        <TransportCompanyForm
          onCreate={onCreate}
          onSuccess={onSuccess}
          onUpdate={() => {
            throw new Error('Update is not available while creating')
          }}
        />
      </div>
    </div>
  )
}
