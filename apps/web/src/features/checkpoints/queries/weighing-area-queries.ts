import type { WeighingAreaDto } from '@/features/checkpoints/types'

type WeighingAreaResponse = { data: WeighingAreaDto[] }
type WeighingAreaDetailResponse = { data: WeighingAreaDto }

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`Request failed with status ${response.status}`)
  return response.json() as Promise<T>
}

export const weighingAreaQueries = {
  list: () => ({
    queryKey: ['weighing-areas', 'list'],
    queryFn: () => request<WeighingAreaResponse>('/api/v1/weighing-areas'),
  }),
  detail: (id: string) => ({
    queryKey: ['weighing-areas', 'detail', id],
    queryFn: () => request<WeighingAreaDetailResponse>(`/api/v1/weighing-areas/${id}`),
  }),
}
