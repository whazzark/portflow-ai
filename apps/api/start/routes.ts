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

router
  .group(() => {
    router.post('/', [controllers.Customers, 'store']).as('store')
    router.get('/', [controllers.Customers, 'index']).as('index')
    router.get('/available', [controllers.Customers, 'available']).as('available')
    router.get('/:id', [controllers.Customers, 'show']).as('show')
    router.patch('/:id', [controllers.Customers, 'update']).as('update')
  })
  .prefix('/api/v1/customers')
  .as('customers')
  .use(middleware.auth())
