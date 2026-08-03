import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { useEffect } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { TransportCompaniesError } from '@/features/transport-companies/ui/transport-companies-error'
import { TransportCompanyDetails } from '@/features/transport-companies/ui/transport-company-details'
import { TransportCompanySection } from '@/features/transport-companies/ui/transport-company-section'
import { TrucksPage } from '@/features/trucks/ui/trucks-page'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TransportResourcesWorkspace() {
  const { companySearch, companyDetailsId, transportCompanyId } =
    transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const companies = companiesQuery.data?.data ?? []
  const selectedCompany = companies.find((company) => company.id === transportCompanyId)
  const companyDetails = companies.find((company) => company.id === companyDetailsId)

  useEffect(() => {
    if (transportCompanyId && companiesQuery.data && !selectedCompany) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, transportCompanyId: undefined, truckId: undefined }),
      })
    }
  }, [companiesQuery.data, navigate, selectedCompany, transportCompanyId])

  useEffect(() => {
    if (companyDetailsId && companiesQuery.data && !companyDetails) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, companyDetailsId: undefined }),
      })
    }
  }, [companiesQuery.data, companyDetails, companyDetailsId, navigate])

  if (companiesQuery.isError) {
    return <TransportCompaniesError onRetry={() => companiesQuery.refetch()} />
  }

  if (!companiesQuery.data) {
    return null
  }

  const toggleCompany = (id: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        transportCompanyId: previous.transportCompanyId === id ? undefined : id,
        truckId: undefined,
      }),
    })
  }

  const openCompanyDetails = (id: string) => {
    void navigate({
      search: (previous) => ({ ...previous, companyDetailsId: id }),
    })
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:h-full lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)] lg:overflow-hidden">
      <Card
        aria-label="Transport company directory"
        className="min-h-[28rem] gap-0 py-0 lg:min-h-0"
      >
        <CardContent className="flex min-h-0 flex-1 flex-col px-0">
          <div className="border-b p-3">
            <Field>
              <FieldLabel className="sr-only" htmlFor="transport-company-search">
                Search transport companies
              </FieldLabel>
              <div className="relative">
                <SearchIcon
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  className="pl-9"
                  id="transport-company-search"
                  onChange={(event) =>
                    navigate({
                      replace: true,
                      search: (previous) => ({ ...previous, companySearch: event.target.value }),
                    })
                  }
                  placeholder="Search transport companies"
                  value={companySearch}
                />
              </div>
            </Field>
          </div>
          <TransportCompanySection
            companies={companies}
            lifecycle="all"
            onDetails={openCompanyDetails}
            onSelect={toggleCompany}
            search={companySearch}
            selectedId={transportCompanyId}
            showStatus={true}
          />
        </CardContent>
      </Card>

      <TrucksPage embedded={true} />

      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            void navigate({ search: (previous) => ({ ...previous, companyDetailsId: undefined }) })
          }
        }}
        open={Boolean(companyDetails)}
      >
        <SheetContent aria-label="Transport company details" className="overflow-y-auto">
          {companyDetails && <TransportCompanyDetails company={companyDetails} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}
