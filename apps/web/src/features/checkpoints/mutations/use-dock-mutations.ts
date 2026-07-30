import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dockQueries } from '@/features/checkpoints/queries/dock-queries'
import type { DockDto } from '@/features/checkpoints/types'
import { tuyauQuery } from '@/libraries/tuyau/client'

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  })
  const body = await response.json()
  if (!response.ok) {
    throw { response: body }
  }
  return body as T
}

type LifecycleVariables = { params: { id: string | number }; body: { comment: string | null } }

export function useDockMutations() {
  const queryClient = useQueryClient()

  const refreshDock = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: dockQueries.list().queryKey })
    await queryClient.invalidateQueries({ queryKey: dockQueries.available().queryKey })
    if (id) {
      await queryClient.invalidateQueries({ queryKey: dockQueries.detail(id).queryKey })
    }
  }

  return {
    archive: useMutation({
      mutationFn: (variables: LifecycleVariables) =>
        request<{ data: DockDto }>(`/api/v1/docks/${variables.params.id}/archive`, {
          method: 'POST',
          body: JSON.stringify(variables.body),
        }),
      onSuccess: (result) => refreshDock(result.data.id),
      onError: (_error, variables) => {
        void refreshDock(String(variables.params.id))
      },
    }),
    create: useMutation(
      tuyauQuery.docks.store.mutationOptions({
        onSuccess: (result) => refreshDock(result.data.id),
      }),
    ),
    update: useMutation(
      tuyauQuery.docks.update.mutationOptions({
        onSuccess: (result) => refreshDock(result.data.id),
      }),
    ),
    reactivate: useMutation({
      mutationFn: (variables: LifecycleVariables) =>
        request<{ data: DockDto }>(`/api/v1/docks/${variables.params.id}/reactivate`, {
          method: 'POST',
          body: JSON.stringify(variables.body),
        }),
      onSuccess: (result) => refreshDock(result.data.id),
      onError: (_error, variables) => {
        void refreshDock(String(variables.params.id))
      },
    }),
  }
}
