import { XIcon } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import { useTransportCompanyMutations } from '@/features/transport-companies/mutations/use-transport-company-mutations'
import { TRANSPORT_COMPANY_SINGULAR } from '@/features/transport-companies/transport-company-lifecycle'
import type { TransportCompanyDto } from '@/features/transport-companies/types'
import { useTransportCompanyForm } from '@/features/transport-companies/ui/transport-company-form'
import { useTruckMutations } from '@/features/trucks/mutations/use-truck-mutations'
import { TRUCK_SINGULAR } from '@/features/trucks/truck-lifecycle'
import type { TruckDto } from '@/features/trucks/types'
import { useTruckForm } from '@/features/trucks/ui/truck-form'
import { TruckStatusPill } from '@/features/trucks/ui/truck-status-pill'
import { resourceSuccessMessage, WRITE_PENDING_LABELS } from '@/helpers/resource-copy'
import { classnames } from '@/libraries/shadcn/helpers'
import { FLEET_COLUMN_COUNT } from './company-group-rows'

/** Escape leaves the form as Cancel does, unless an open popup (a select) handled it first. */
function cancelOnEscape(onCancel: () => void) {
  return (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      onCancel()
    }
  }
}

function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TableRow
      className={classnames('border-t border-b-0 bg-muted/30 hover:bg-muted/30', className)}
    >
      <TableCell className="whitespace-normal py-3 pr-2.5 pl-12" colSpan={FLEET_COLUMN_COUNT}>
        {children}
      </TableCell>
    </TableRow>
  )
}

const FIELD_LABEL = 'text-muted-foreground text-xs'

export function TruckFormRow({
  truck,
  company,
  companies,
  onCancel,
  onSaved,
}: {
  /** The truck corrected; a new one when absent. */
  truck?: TruckDto
  /** The company a new truck joins, fixed by the company's Add truck. */
  company?: TransportCompanyDto
  /** The companies to choose from, when the company is not fixed. */
  companies: Array<Pick<TransportCompanyDto, 'id' | 'name'>>
  onCancel: () => void
  onSaved: (truck: TruckDto) => void
}) {
  const mutations = useTruckMutations()
  const action = truck ? 'update' : 'create'
  const form = useTruckForm({
    truck,
    transportCompanyId: company?.id,
    onSubmit: async (value) =>
      truck
        ? (await mutations.update.mutateAsync({ params: { id: truck.id }, body: value })).data
        : (await mutations.create.mutateAsync({ body: value })).data,
    onSuccess: (saved) => {
      toast.success(resourceSuccessMessage(action, TRUCK_SINGULAR, saved.registration))
      onSaved(saved)
    },
  })

  return (
    <FormRow>
      <form.AppForm>
        <form.Form
          aria-label={truck ? `Edit ${truck.registration}` : 'Create truck'}
          className="flex flex-col gap-2"
          onKeyDown={cancelOnEscape(onCancel)}
        >
          <div className="grid items-start gap-3 md:grid-cols-[142px_146px_86px_minmax(0,1fr)_116px_auto]">
            <form.AppField name="registration">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  autoFocus={true}
                  className="font-mono"
                  label="Registration"
                  labelClassName={FIELD_LABEL}
                  placeholder="AB-123-CD"
                  required={true}
                />
              )}
            </form.AppField>
            <form.AppField name="vehicleModel">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  label="Vehicle model"
                  labelClassName={FIELD_LABEL}
                  placeholder="Vehicle model"
                />
              )}
            </form.AppField>
            <form.AppField name="capacityTonnes">
              {(field) => (
                <field.TextField
                  autoComplete="off"
                  inputMode="decimal"
                  label="Capacity (tonnes)"
                  labelClassName={FIELD_LABEL}
                  placeholder="t"
                  required={true}
                />
              )}
            </form.AppField>
            {company ? (
              <p className="self-center pt-5 text-muted-foreground text-sm">
                Added to {company.name}
              </p>
            ) : (
              <form.AppField name="transportCompanyId">
                {(field) => (
                  <field.SelectField
                    label="Transport company"
                    labelClassName={FIELD_LABEL}
                    options={companies.map(({ id, name }) => ({ label: name, value: id }))}
                    placeholder="Select a transport company"
                    required={true}
                  />
                )}
              </form.AppField>
            )}
            <div className="self-center pt-5">
              <TruckStatusPill status={truck?.status ?? 'AVAILABLE'} />
            </div>
            <div className="flex items-center gap-1 self-center pt-5">
              <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS[action]}>
                Save
              </form.SubmitButton>
              <Button
                aria-label={truck ? 'Cancel edit' : 'Cancel new truck'}
                onClick={onCancel}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <form.FormError />
        </form.Form>
      </form.AppForm>
    </FormRow>
  )
}

export function CompanyFormRow({
  company,
  onCancel,
  onSaved,
}: {
  /** The company corrected; a new one when absent. */
  company?: TransportCompanyDto
  onCancel: () => void
  onSaved: (company: TransportCompanyDto) => void
}) {
  const mutations = useTransportCompanyMutations()
  const action = company ? 'update' : 'create'
  const form = useTransportCompanyForm({
    company,
    onSubmit: async (value) =>
      company
        ? (await mutations.update.mutateAsync({ params: { id: company.id }, body: value })).data
        : (await mutations.create.mutateAsync({ body: value })).data,
    onSuccess: (saved) => {
      toast.success(resourceSuccessMessage(action, TRANSPORT_COMPANY_SINGULAR, saved.name))
      onSaved(saved)
    },
  })

  return (
    <FormRow className="bg-muted/60 hover:bg-muted/60">
      <form.AppForm>
        <form.Form
          aria-label={company ? `Edit ${company.name}` : 'Create transport company'}
          className="flex flex-col gap-2"
          onKeyDown={cancelOnEscape(onCancel)}
        >
          <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
            <form.AppField name="name">
              {(field) => (
                <field.TextField
                  autoComplete="organization"
                  autoFocus={true}
                  label="Company name"
                  labelClassName={FIELD_LABEL}
                  placeholder="Company name"
                  required={true}
                />
              )}
            </form.AppField>
            <form.AppField name="contactPhone">
              {(field) => (
                <field.TextField
                  autoComplete="tel"
                  label="Contact phone"
                  labelClassName={FIELD_LABEL}
                  placeholder="+33 2 40 12 34 56"
                  required={true}
                  type="tel"
                />
              )}
            </form.AppField>
            <form.AppField name="contactEmail">
              {(field) => (
                <field.TextField
                  autoComplete="email"
                  label="Contact email"
                  labelClassName={FIELD_LABEL}
                  placeholder="dispatch@example.com"
                  required={true}
                  type="email"
                />
              )}
            </form.AppField>
            <div className="flex items-center gap-1 self-center pt-5">
              <form.SubmitButton pendingLabel={WRITE_PENDING_LABELS[action]}>
                {company ? 'Save' : 'Create'}
              </form.SubmitButton>
              <Button
                aria-label={company ? 'Cancel edit' : 'Cancel new company'}
                onClick={onCancel}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          </div>
          <form.FormError />
        </form.Form>
      </form.AppForm>
    </FormRow>
  )
}
