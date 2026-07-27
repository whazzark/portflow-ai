import { registry } from '@portflow/api/registry'
import { createIsomorphicFn } from '@tanstack/react-start'
import { createTuyau } from '@tuyau/core/client'
import { createTuyauReactQueryClient } from '@tuyau/react-query'

const getRequestCookie = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeader } = await import('@tanstack/react-start/server')

    return getRequestHeader('cookie')
  })
  .client(() => undefined)

export const tuyau = createTuyau({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  registry,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      async (request) => {
        const cookie = await getRequestCookie()

        if (cookie) {
          request.headers.set('cookie', cookie)
        }
      },
    ],
  },
})

export const tuyauQuery = createTuyauReactQueryClient({ client: tuyau })
