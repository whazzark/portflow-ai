import { tuyauQuery } from '@/libraries/tuyau/client'

export const userQueries = {
  list: () => tuyauQuery.users.index.queryOptions({}),
}
