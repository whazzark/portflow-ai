/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: {
    show: typeof routes['health.show']
  }
  auth: {
    login: typeof routes['auth.login']
    me: typeof routes['auth.me']
    logout: typeof routes['auth.logout']
  }
}
