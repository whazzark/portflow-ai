import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router.get('/health', [controllers.Health, 'show']).as('health.show')

router
  .group(() => {
    router.post('/login', [controllers.Login, 'store']).as('login')
    router.get('/me', [controllers.Me, 'show']).as('me').use(middleware.auth())
    router.post('/logout', [controllers.Logout, 'destroy']).as('logout').use(middleware.auth())
  })
  .prefix('/auth')
  .as('auth')
