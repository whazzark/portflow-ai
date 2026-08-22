import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    <section aria-label="Edit transport company" className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b px-5 py-4 md:px-6">
        <Button className="mb-3 self-start" onClick={onCancel} size="sm" variant="ghost">
          <ArrowLeftIcon aria-hidden="true" />
          Back to company details
        </Button>
        <h2 className="font-heading font-semibold text-xl">Edit transport company</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Update the current company name for {company.name}.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-6">
        <TransportCompanyForm company={company} onSuccess={onSuccess} onUpdate={onUpdate} />
      </div>
    </section>
  )
}
