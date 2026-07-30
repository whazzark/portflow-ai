import { getRouteApi } from '@tanstack/react-router'
import { useAuthenticatedUser } from '@/features/auth/context/use-authenticated-user'
import { isAdministrator } from '@/features/auth/policies/permissions'

const checkpointsRoute = getRouteApi('/_authenticated/checkpoints')

export function CheckpointsPage() {
  const user = useAuthenticatedUser()
  const navigate = checkpointsRoute.useNavigate()
  const search = checkpointsRoute.useSearch()

  if (!isAdministrator(user)) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p role="alert">Administrator access required to open Checkpoints.</p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-muted-foreground text-sm">Site references</p>
        <h1 className="font-semibold text-2xl">Checkpoints</h1>
      </div>

      <div aria-label="Checkpoint resources" className="flex gap-2" role="tablist">
        {(['docks', 'weighing-areas'] as const).map((resource) => (
          <button
            aria-selected={search.resource === resource}
            key={resource}
            onClick={() => navigate({ search: (current) => ({ ...current, resource }) })}
            role="tab"
            type="button"
          >
            {resource === 'docks' ? 'Docks' : 'Weighing Areas'}
          </button>
        ))}
      </div>

      <div aria-label="Checkpoint lifecycle" className="flex gap-2" role="tablist">
        {(['available', 'archived'] as const).map((status) => (
          <button
            aria-selected={search.status === status}
            key={status}
            onClick={() => navigate({ search: (current) => ({ ...current, status }) })}
            role="tab"
            type="button"
          >
            {status === 'available' ? 'Available' : 'Archived'}
          </button>
        ))}
      </div>
    </main>
  )
}
