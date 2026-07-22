import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router.get('/health', [controllers.Health, 'show']).as('health.show')

router.post('/api/v1/auth/login', [controllers.Login, 'store']).as('auth.login')

router
  .group(() => {
    router
      .group(() => {
        router.get('/me', [controllers.Me, 'show']).as('me')
        router.post('/logout', [controllers.Logout, 'destroy']).as('logout')
      })
      .prefix('/auth')
      .as('auth')

    router
      .group(() => {
        router.post('/', [controllers.Customers, 'store']).as('store')
        router.get('/', [controllers.Customers, 'index']).as('index')
        router.get('/available', [controllers.Customers, 'available']).as('available')
        router.get('/:id', [controllers.Customers, 'show']).as('show')
        router.patch('/:id', [controllers.Customers, 'update']).as('update')
      })
      .prefix('/customers')
      .as('customers')
  })
  .prefix('/api/v1')
  .use(middleware.auth())
