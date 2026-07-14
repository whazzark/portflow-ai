import { registry } from '@portflow/api/registry'
import { createTuyau } from '@tuyau/core/client'
import { createTuyauReactQueryClient } from '@tuyau/react-query'

export const tuyau = createTuyau({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  registry,
  credentials: 'include',
})

export const tuyauQuery = createTuyauReactQueryClient({ client: tuyau })
