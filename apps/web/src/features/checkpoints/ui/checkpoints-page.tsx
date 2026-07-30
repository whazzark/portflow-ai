import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { SearchIcon, XIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'
import { useDockMutations } from '@/features/checkpoints/mutations/use-dock-mutations'
import { useWeighingAreaMutations } from '@/features/checkpoints/mutations/use-weighing-area-mutations'
import { dockQueries } from '@/features/checkpoints/queries/dock-queries'
import { weighingAreaQueries } from '@/features/checkpoints/queries/weighing-area-queries'
import type { DockDto, WeighingAreaDto } from '@/features/checkpoints/types'
import { DockForm } from '@/features/checkpoints/ui/dock-form'
import { WeighingAreaForm } from '@/features/checkpoints/ui/weighing-area-form'
import { normalizeSearch } from '@/helpers/search'

const checkpointsRoute = getRouteApi('/_authenticated/checkpoints')

function DockDetails({
  dock,
  onClose,
  onEdit,
  onCreate,
  onUpdate,
  mode = 'view',
  onSuccess,
}: {
  dock?: DockDto
  onClose: () => void
  onEdit?: () => void
  onCreate?: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  onUpdate?: (value: { name: string; latitude: number; longitude: number }) => Promise<DockDto>
  mode?: 'view' | 'edit' | 'create'
  onSuccess?: (dock: DockDto) => void
}) {
  if ((mode === 'create' && onCreate) || (mode === 'edit' && dock && onUpdate)) {
    const isCreate = mode === 'create'
    return (
      <div className="fixed inset-0 z-20 flex justify-end bg-black/20" role="presentation">
        <aside
          aria-label={isCreate ? 'Create dock' : `Edit ${dock?.name}`}
          className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-background p-6 shadow-xl"
          role="dialog"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-semibold text-xl">{isCreate ? 'Create dock' : 'Edit dock'}</h2>
            <Button aria-label="Close dock form" onClick={onClose} size="icon" variant="ghost">
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-8">
            <DockForm
              dock={isCreate ? undefined : dock}
              onCreate={onCreate ?? (async () => dock as DockDto)}
              onSuccess={onSuccess ?? onClose}
              onUpdate={onUpdate ?? (async () => dock as DockDto)}
            />
          </div>
        </aside>
      </div>
    )
  }

  if (!dock) {
    return null
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" role="presentation">
      <aside
        aria-label={dock.name}
        className="flex h-full w-full max-w-md flex-col bg-background p-6 shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-xl">{dock.name}</h2>
            <p className="text-muted-foreground text-sm">
              {dock.status === 'ARCHIVED' ? 'Archived' : 'Available'}
            </p>
          </div>
          <div className="flex gap-2">
            {dock.status === 'AVAILABLE' && onEdit && (
              <Button aria-label="Edit dock" onClick={onEdit} variant="outline">
                Edit
              </Button>
            )}
            <Button aria-label="Close dock details" onClick={onClose} size="icon" variant="ghost">
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        <dl className="mt-8 grid gap-4 text-sm">
          <div>
            <dt className="font-medium">GPS location</dt>
            <dd>
              {dock.latitude}, {dock.longitude}
            </dd>
          </div>
          {dock.archiveComment && (
            <div>
              <dt className="font-medium">Archive comment</dt>
              <dd>{dock.archiveComment}</dd>
            </div>
          )}
        </dl>
      </aside>
    </div>
  )
}

function DockList({
  docks,
  status,
  search,
  sort,
  onSort,
  onSelect,
}: {
  docks: DockDto[]
  status: 'available' | 'archived'
  search: string
  sort: 'asc' | 'desc'
  onSort: () => void
  onSelect: (id: string) => void
}) {
  const visibleDocks = useMemo(() => {
    const filter = normalizeSearch(search)
    return docks
      .filter((dock) => dock.status === (status === 'available' ? 'AVAILABLE' : 'ARCHIVED'))
      .filter((dock) => !filter || normalizeSearch(dock.name).includes(filter))
      .sort((left, right) => {
        const result = normalizeSearch(left.name).localeCompare(normalizeSearch(right.name))
        return sort === 'asc' ? result : -result
      })
  }, [docks, search, sort, status])

  if (visibleDocks.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{search ? 'No docks match your search' : `No ${status} docks`}</EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>
          {search
            ? 'Try a different dock name.'
            : 'Docks will appear here when they are available.'}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <Table aria-label={`${status === 'available' ? 'Available' : 'Archived'} docks`}>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Button aria-label={`Dock name, sorted ${sort}`} onClick={onSort} variant="ghost">
              Dock name
            </Button>
          </TableHead>
          <TableHead>GPS location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleDocks.map((dock) => (
          <TableRow key={dock.id}>
            <TableCell>
              <Button
                aria-label={`View dock ${dock.name}`}
                className="h-auto px-0 font-medium"
                onClick={() => onSelect(dock.id)}
                variant="link"
              >
                {dock.name}
              </Button>
            </TableCell>
            <TableCell>
              {dock.latitude}, {dock.longitude}
            </TableCell>
            <TableCell>{dock.status === 'ARCHIVED' ? 'Archived' : 'Available'}</TableCell>
            <TableCell>
              <Button
                aria-label={`Inspect dock ${dock.name}`}
                onClick={() => onSelect(dock.id)}
                variant="outline"
              >
                Inspect
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WeighingAreaDetails({
  area,
  onClose,
  onEdit,
  onCreate,
  onUpdate,
  mode = 'view',
  onSuccess,
}: {
  area?: WeighingAreaDto
  onClose: () => void
  onEdit?: () => void
  onCreate?: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<WeighingAreaDto>
  onUpdate?: (value: {
    name: string
    latitude: number
    longitude: number
  }) => Promise<WeighingAreaDto>
  mode?: 'view' | 'edit' | 'create'
  onSuccess?: (area: WeighingAreaDto) => void
}) {
  if ((mode === 'create' && onCreate) || (mode === 'edit' && area && onUpdate)) {
    const isCreate = mode === 'create'
    return (
      <div className="fixed inset-0 z-20 flex justify-end bg-black/20" role="presentation">
        <aside
          aria-label={isCreate ? 'Create weighing area' : `Edit ${area?.name}`}
          className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-background p-6 shadow-xl"
          role="dialog"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-semibold text-xl">
              {isCreate ? 'Create weighing area' : 'Edit weighing area'}
            </h2>
            <Button
              aria-label="Close weighing area form"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
          <div className="mt-8">
            <WeighingAreaForm
              area={isCreate ? undefined : area}
              onCreate={onCreate ?? (async () => area as WeighingAreaDto)}
              onSuccess={onSuccess ?? onClose}
              onUpdate={onUpdate ?? (async () => area as WeighingAreaDto)}
            />
          </div>
        </aside>
      </div>
    )
  }
  if (!area) {
    return null
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" role="presentation">
      <aside
        aria-label={area.name}
        className="flex h-full w-full max-w-md flex-col bg-background p-6 shadow-xl"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-xl">{area.name}</h2>
            <p className="text-muted-foreground text-sm">
              {area.status === 'ARCHIVED' ? 'Archived' : 'Available'}
            </p>
          </div>
          <div className="flex gap-2">
            {area.status === 'AVAILABLE' && onEdit && (
              <Button aria-label="Edit weighing area" onClick={onEdit} variant="outline">
                Edit
              </Button>
            )}
            <Button
              aria-label="Close weighing area details"
              onClick={onClose}
              size="icon"
              variant="ghost"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        </div>
        <dl className="mt-8 grid gap-4 text-sm">
          <div>
            <dt className="font-medium">GPS location</dt>
            <dd>
              {area.latitude}, {area.longitude}
            </dd>
          </div>
          {area.archiveComment && (
            <div>
              <dt className="font-medium">Archive comment</dt>
              <dd>{area.archiveComment}</dd>
            </div>
          )}
        </dl>
      </aside>
    </div>
  )
}

function WeighingAreaList({
  areas,
  status,
  search,
  sort,
  onSort,
  onSelect,
}: {
  areas: WeighingAreaDto[]
  status: 'available' | 'archived'
  search: string
  sort: 'asc' | 'desc'
  onSort: () => void
  onSelect: (id: string) => void
}) {
  const visibleAreas = useMemo(() => {
    const filter = normalizeSearch(search)
    return areas
      .filter((area) => area.status === (status === 'available' ? 'AVAILABLE' : 'ARCHIVED'))
      .filter((area) => !filter || normalizeSearch(area.name).includes(filter))
      .sort((left, right) => {
        const result = normalizeSearch(left.name).localeCompare(normalizeSearch(right.name))
        return sort === 'asc' ? result : -result
      })
  }, [areas, search, sort, status])

  if (visibleAreas.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {search ? 'No weighing areas match your search' : `No ${status} weighing areas`}
          </EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>
          {search
            ? 'Try a different weighing area name.'
            : 'Weighing areas will appear here when they are available.'}
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <Table aria-label={`${status === 'available' ? 'Available' : 'Archived'} weighing areas`}>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Button
              aria-label={`Weighing area name, sorted ${sort}`}
              onClick={onSort}
              variant="ghost"
            >
              Weighing area name
            </Button>
          </TableHead>
          <TableHead>GPS location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visibleAreas.map((area) => (
          <TableRow key={area.id}>
            <TableCell>
              <Button
                aria-label={`View weighing area ${area.name}`}
                className="h-auto px-0 font-medium"
                onClick={() => onSelect(area.id)}
                variant="link"
              >
                {area.name}
              </Button>
            </TableCell>
            <TableCell>
              {area.latitude}, {area.longitude}
            </TableCell>
            <TableCell>{area.status === 'ARCHIVED' ? 'Archived' : 'Available'}</TableCell>
            <TableCell>
              <Button
                aria-label={`Inspect weighing area ${area.name}`}
                onClick={() => onSelect(area.id)}
                variant="outline"
              >
                Inspect
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function WeighingAreaWorkbench() {
  const navigate = checkpointsRoute.useNavigate()
  const { status, q, sort, detail, mode } = checkpointsRoute.useSearch()
  const mutations = useWeighingAreaMutations()
  const areasQuery = useQuery(weighingAreaQueries.list())
  const detailQuery = useQuery({
    ...weighingAreaQueries.detail(detail ?? ''),
    enabled: Boolean(detail),
  })
  const areas = areasQuery.data?.data ?? []

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 md:p-6">
      <div>
        <p className="text-muted-foreground text-sm">Site references</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-semibold text-2xl">Checkpoints</h1>
          <Button
            onClick={() =>
              navigate({ search: (current) => ({ ...current, mode: 'create', detail: undefined }) })
            }
          >
            Create weighing area
          </Button>
        </div>
      </div>
      <div aria-label="Checkpoint resources" className="flex gap-2" role="tablist">
        <button
          aria-selected={false}
          onClick={() => navigate({ search: (current) => ({ ...current, resource: 'docks' }) })}
          role="tab"
          type="button"
        >
          Docks
        </button>
        <button aria-selected={true} role="tab" type="button">
          Weighing Areas
        </button>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <label className="sr-only" htmlFor="weighing-area-search">
            Search weighing areas
          </label>
          <span className="relative block">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              id="weighing-area-search"
              aria-label="Search weighing areas"
              className="pl-9"
              onChange={(event) =>
                navigate({ search: (current) => ({ ...current, q: event.target.value }) })
              }
              placeholder="Search weighing areas"
              value={q}
            />
          </span>
        </div>
      </div>
      <div aria-label="Weighing area lifecycle" className="flex gap-2" role="tablist">
        <button
          aria-selected={status === 'available'}
          onClick={() => navigate({ search: (current) => ({ ...current, status: 'available' }) })}
          role="tab"
          type="button"
        >
          Available ({areas.filter((area) => area.status === 'AVAILABLE').length})
        </button>
        <button
          aria-selected={status === 'archived'}
          onClick={() => navigate({ search: (current) => ({ ...current, status: 'archived' }) })}
          role="tab"
          type="button"
        >
          Archived ({areas.filter((area) => area.status === 'ARCHIVED').length})
        </button>
      </div>
      {areasQuery.isPending && <p role="status">Loading weighing areas…</p>}
      {areasQuery.isError && (
        <div role="alert">
          <p>Could not load weighing areas.</p>
          <Button onClick={() => void areasQuery.refetch()}>Retry loading weighing areas</Button>
        </div>
      )}
      {areasQuery.isSuccess && (
        <WeighingAreaList
          areas={areas}
          search={q}
          sort={sort}
          status={status}
          onSelect={(id) =>
            navigate({ search: (current) => ({ ...current, detail: id, mode: 'view' }) })
          }
          onSort={() =>
            navigate({
              search: (current) => ({ ...current, sort: current.sort === 'asc' ? 'desc' : 'asc' }),
            })
          }
        />
      )}
      {mode === 'view' && detail && detailQuery.data?.data && (
        <WeighingAreaDetails
          area={detailQuery.data.data}
          onEdit={() => navigate({ search: (current) => ({ ...current, mode: 'edit' }) })}
          onClose={() =>
            navigate({ search: (current) => ({ ...current, detail: undefined, mode: undefined }) })
          }
        />
      )}
      {mode === 'edit' && detail && detailQuery.data?.data && (
        <WeighingAreaDetails
          area={detailQuery.data.data}
          mode="edit"
          onClose={() => navigate({ search: (current) => ({ ...current, mode: 'view' }) })}
          onUpdate={async (value) =>
            (await mutations.update.mutateAsync({ params: { id: detail }, body: value })).data
          }
          onSuccess={(area) =>
            navigate({ search: (current) => ({ ...current, detail: area.id, mode: 'view' }) })
          }
        />
      )}
      {mode === 'create' && (
        <WeighingAreaDetails
          mode="create"
          onClose={() => navigate({ search: (current) => ({ ...current, mode: undefined }) })}
          onCreate={async (value) => (await mutations.create.mutateAsync({ body: value })).data}
          onSuccess={(area) =>
            navigate({ search: (current) => ({ ...current, detail: area.id, mode: 'view' }) })
          }
        />
      )}
    </main>
  )
}

export function CheckpointsPage() {
  const user = useAuthenticatedUser()
  const navigate = checkpointsRoute.useNavigate()
  const { resource, status, q, sort, detail, mode } = checkpointsRoute.useSearch()
  const mutations = useDockMutations()
  const docksQuery = useQuery({ ...dockQueries.list(), enabled: resource === 'docks' })
  const detailQuery = useQuery({
    ...dockQueries.detail(detail ?? ''),
    enabled: resource === 'docks' && Boolean(detail),
  })

  if (!isAdministrator(user)) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p role="alert">Administrator access required to open Checkpoints.</p>
      </main>
    )
  }

  if (resource !== 'docks') {
    return <WeighingAreaWorkbench />
  }

  const docks = docksQuery.data?.data ?? []
  const count = docks.filter(
    (dock) => dock.status === (status === 'available' ? 'AVAILABLE' : 'ARCHIVED'),
  ).length

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-4 md:p-6">
      <div>
        <p className="text-muted-foreground text-sm">Site references</p>
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-semibold text-2xl">Checkpoints</h1>
          <Button
            onClick={() =>
              navigate({ search: (current) => ({ ...current, mode: 'create', detail: undefined }) })
            }
          >
            Create dock
          </Button>
        </div>
      </div>
      <div aria-label="Checkpoint resources" className="flex gap-2" role="tablist">
        <button
          aria-selected={true}
          onClick={() => navigate({ search: (current) => ({ ...current, resource: 'docks' }) })}
          role="tab"
          type="button"
        >
          Docks
        </button>
        <button
          aria-selected={false}
          onClick={() =>
            navigate({ search: (current) => ({ ...current, resource: 'weighing-areas' }) })
          }
          role="tab"
          type="button"
        >
          Weighing Areas
        </button>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <label className="sr-only" htmlFor="dock-search">
            Search docks
          </label>
          <span className="relative block">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              id="dock-search"
              aria-label="Search docks"
              className="pl-9"
              onChange={(event) =>
                navigate({ search: (current) => ({ ...current, q: event.target.value }) })
              }
              placeholder="Search docks"
              value={q}
            />
          </span>
        </div>
      </div>
      <div aria-label="Dock lifecycle" className="flex gap-2" role="tablist">
        <button
          aria-selected={status === 'available'}
          onClick={() => navigate({ search: (current) => ({ ...current, status: 'available' }) })}
          role="tab"
          type="button"
        >
          Available ({docks.filter((dock) => dock.status === 'AVAILABLE').length})
        </button>
        <button
          aria-selected={status === 'archived'}
          onClick={() => navigate({ search: (current) => ({ ...current, status: 'archived' }) })}
          role="tab"
          type="button"
        >
          Archived ({docks.filter((dock) => dock.status === 'ARCHIVED').length})
        </button>
      </div>
      {docksQuery.isPending && <p role="status">Loading docks…</p>}
      {docksQuery.isError && (
        <div role="alert">
          <p>Could not load docks.</p>
          <Button onClick={() => void docksQuery.refetch()}>Retry loading docks</Button>
        </div>
      )}
      {docksQuery.isSuccess && (
        <DockList
          docks={docks}
          search={q}
          sort={sort}
          status={status}
          onSelect={(id) =>
            navigate({ search: (current) => ({ ...current, detail: id, mode: 'view' }) })
          }
          onSort={() =>
            navigate({
              search: (current) => ({ ...current, sort: current.sort === 'asc' ? 'desc' : 'asc' }),
            })
          }
        />
      )}
      <span className="sr-only">
        {count} {status} docks
      </span>
      {mode === 'view' && detail && detailQuery.data?.data && (
        <DockDetails
          dock={detailQuery.data.data}
          onClose={() =>
            navigate({ search: (current) => ({ ...current, detail: undefined, mode: undefined }) })
          }
          onEdit={() => navigate({ search: (current) => ({ ...current, mode: 'edit' }) })}
          onUpdate={async (value) =>
            (await mutations.update.mutateAsync({ params: { id: detail }, body: value })).data
          }
        />
      )}
      {mode === 'edit' && detail && detailQuery.data?.data && (
        <DockDetails
          dock={detailQuery.data.data}
          mode="edit"
          onClose={() => navigate({ search: (current) => ({ ...current, mode: 'view' }) })}
          onUpdate={async (value) =>
            (await mutations.update.mutateAsync({ params: { id: detail }, body: value })).data
          }
          onSuccess={(dock) =>
            navigate({ search: (current) => ({ ...current, detail: dock.id, mode: 'view' }) })
          }
        />
      )}
      {mode === 'create' && (
        <DockDetails
          mode="create"
          onClose={() => navigate({ search: (current) => ({ ...current, mode: undefined }) })}
          onCreate={async (value) => (await mutations.create.mutateAsync({ body: value })).data}
          onSuccess={(dock) =>
            navigate({ search: (current) => ({ ...current, detail: dock.id, mode: 'view' }) })
          }
        />
      )}
    </main>
  )
}
