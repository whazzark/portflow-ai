import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { useEffect } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { transportCompanyQueries } from '@/features/transport-companies/queries/transport-company-queries'
import { TransportCompanyDetails } from '@/features/transport-companies/ui/transport-company-details'
import { TransportCompanyOverview } from '@/features/transport-companies/ui/transport-company-overview'
import { TransportCompanySection } from '@/features/transport-companies/ui/transport-company-section'

const transportResourcesRoute = getRouteApi('/_authenticated/transport-resources')

export function TransportCompaniesPage() {
  const { companyStatus, companySearch, transportCompanyId } = transportResourcesRoute.useSearch()
  const navigate = transportResourcesRoute.useNavigate()
  const companiesQuery = useQuery(transportCompanyQueries.all())
  const companies = companiesQuery.data?.data ?? []
  const selected = companies.find((company) => company.id === transportCompanyId)

  useEffect(() => {
    if (transportCompanyId && companiesQuery.data && !selected) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, transportCompanyId: undefined }),
      })
    }
  }, [companiesQuery.data, navigate, selected, transportCompanyId])

  useEffect(() => {
    if (!selected) {
      return
    }

    const selectedStatus = selected.status === 'ARCHIVED' ? 'archived' : 'available'
    if (companyStatus !== selectedStatus) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, companyStatus: selectedStatus }),
      })
    }
  }, [companyStatus, navigate, selected])

  if (!companiesQuery.data) {
    return null
  }

  const available = companies.filter((company) => company.status === 'AVAILABLE')
  const archived = companies.filter((company) => company.status === 'ARCHIVED')
  const selectedCompanies = companyStatus === 'available' ? available : archived

  const toggleCompany = (id: string) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        transportCompanyId: previous.transportCompanyId === id ? undefined : id,
      }),
    })
  }

  return (
    <main className="relative flex flex-col p-4 md:h-[calc(100svh-3.5rem)] md:min-h-0 md:overflow-hidden md:p-6">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)]">
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
                        search: (previous) => ({
                          ...previous,
                          companySearch: event.target.value,
                        }),
                      })
                    }
                    placeholder="Search by company name"
                    value={companySearch}
                  />
                </div>
              </Field>
            </div>

            <Tabs
              className="min-h-0 flex-1 gap-0"
              onValueChange={(value) => {
                if (value === 'available' || value === 'archived') {
                  void navigate({
                    search: (previous) => ({
                      ...previous,
                      companyStatus: value,
                      transportCompanyId: undefined,
                    }),
                  })
                }
              }}
              value={companyStatus}
            >
              <TabsList aria-label="Transport company status" className="mx-3 mt-3" variant="line">
                <TabsTrigger value="available">
                  Available{' '}
                  <span className="text-muted-foreground tabular-nums">({available.length})</span>
                </TabsTrigger>
                <TabsTrigger value="archived">
                  Archived{' '}
                  <span className="text-muted-foreground tabular-nums">({archived.length})</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent className="min-h-0" value="available">
                {companyStatus === 'available' && (
                  <TransportCompanySection
                    companies={selectedCompanies}
                    lifecycle="available"
                    onSelect={toggleCompany}
                    search={companySearch}
                    selectedId={transportCompanyId}
                  />
                )}
              </TabsContent>
              <TabsContent className="min-h-0" value="archived">
                {companyStatus === 'archived' && (
                  <TransportCompanySection
                    companies={selectedCompanies}
                    lifecycle="archived"
                    onSelect={toggleCompany}
                    search={companySearch}
                    selectedId={transportCompanyId}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="min-h-[24rem] gap-0 py-0 lg:min-h-0">
          {selected ? (
            <TransportCompanyDetails company={selected} />
          ) : (
            <TransportCompanyOverview
              archivedCount={archived.length}
              availableCount={available.length}
            />
          )}
        </Card>
      </div>
    </main>
  )
}
