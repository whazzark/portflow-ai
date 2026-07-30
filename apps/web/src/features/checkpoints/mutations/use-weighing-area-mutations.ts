import { useMutation, useQueryClient } from '@tanstack/react-query'
import { weighingAreaQueries } from '@/features/checkpoints/queries/weighing-area-queries'
import type { WeighingAreaDto } from '@/features/checkpoints/types'

type Payload = { name: string; latitude: number; longitude: number }
type LifecycleVariables = { params: { id: string | number }; body: { comment: string | null } }

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init.headers },
  })
  const body = await response.json()
  if (!response.ok || (typeof body === 'object' && body !== null && 'error' in body)) {
    throw { response: body }
  }
  return body as T
}

export function useWeighingAreaMutations() {
  const queryClient = useQueryClient()

  const refreshWeighingArea = async (id?: string) => {
    await queryClient.invalidateQueries({ queryKey: weighingAreaQueries.list().queryKey })
    if (id) {
      await queryClient.invalidateQueries({ queryKey: weighingAreaQueries.detail(id).queryKey })
    }
  }

  return {
    archive: useMutation({
      mutationFn: (variables: LifecycleVariables) =>
        request<{ data: WeighingAreaDto }>(
          `/api/v1/weighing-areas/${variables.params.id}/archive`,
          { method: 'POST', body: JSON.stringify(variables.body) },
        ),
      onSuccess: (result) => refreshWeighingArea(result.data.id),
      onError: (_error, variables) => {
        void refreshWeighingArea(String(variables.params.id))
      },
    }),
    create: useMutation({
      mutationFn: (variables: { body: Payload }) =>
        request<{ data: WeighingAreaDto }>('/api/v1/weighing-areas', {
          method: 'POST',
          body: JSON.stringify(variables.body),
      }),
      onSuccess: (result) => refreshWeighingArea(result.data.id),
      onError: () => {
        void refreshWeighingArea()
      },
    }),
    update: useMutation({
      mutationFn: (variables: { params: { id: string }; body: Payload }) =>
        request<{ data: WeighingAreaDto }>(`/api/v1/weighing-areas/${variables.params.id}`, {
          method: 'PATCH',
          body: JSON.stringify(variables.body),
      }),
      onSuccess: (result) => refreshWeighingArea(result.data.id),
      onError: (_error, variables) => {
        void refreshWeighingArea(String(variables.params.id))
      },
    }),
    reactivate: useMutation({
      mutationFn: (variables: LifecycleVariables) =>
        request<{ data: WeighingAreaDto }>(
          `/api/v1/weighing-areas/${variables.params.id}/reactivate`,
          { method: 'POST', body: JSON.stringify(variables.body) },
        ),
      onSuccess: (result) => refreshWeighingArea(result.data.id),
      onError: (_error, variables) => {
        void refreshWeighingArea(String(variables.params.id))
      },
    }),
  }
}
