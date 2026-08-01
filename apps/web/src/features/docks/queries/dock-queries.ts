import { tuyauQuery } from '@/libraries/tuyau/client'

export const dockQueries = {
  list: () => tuyauQuery.docks.index.queryOptions({}),
}
