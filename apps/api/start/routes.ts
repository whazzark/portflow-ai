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
        router.post('/archive', [controllers.Customers, 'archiveMany']).as('archive_many')
        router.post('/reactivate', [controllers.Customers, 'reactivateMany']).as('reactivate_many')
        router.patch('/:id', [controllers.Customers, 'update']).as('update')
        router.post('/:id/archive', [controllers.Customers, 'archive']).as('archive')
        router.post('/:id/reactivate', [controllers.Customers, 'reactivate']).as('reactivate')
      })
      .prefix('/customers')
      .as('customers')

    router
      .group(() => {
        router.get('/', [controllers.TransportCompanies, 'index']).as('index')
        router.get('/available', [controllers.TransportCompanies, 'available']).as('available')
      })
      .prefix('/transport-companies')
      .as('transport_companies')

    router
      .group(() => {
        router.get('/', [controllers.Docks, 'index']).as('index')
        router.post('/', [controllers.Docks, 'store']).as('store')
        router.get('/available', [controllers.Docks, 'available']).as('available')
        router.patch('/:id', [controllers.Docks, 'update']).as('update')
        router.post('/:id/archive', [controllers.Docks, 'archive']).as('archive')
        router.post('/:id/reactivate', [controllers.Docks, 'reactivate']).as('reactivate')
      })
      .prefix('/docks')
      .as('docks')

    router
      .group(() => {
        router.get('/', [controllers.WeighingAreas, 'index']).as('index')
        router.post('/', [controllers.WeighingAreas, 'store']).as('store')
        router.get('/available', [controllers.WeighingAreas, 'available']).as('available')
        router.get('/:id', [controllers.WeighingAreas, 'show']).as('show')
        router.patch('/:id', [controllers.WeighingAreas, 'update']).as('update')
        router.post('/:id/archive', [controllers.WeighingAreas, 'archive']).as('archive')
        router.post('/:id/reactivate', [controllers.WeighingAreas, 'reactivate']).as('reactivate')
      })
      .prefix('/weighing-areas')
      .as('weighingAreas')
  })
  .prefix('/api/v1')
  .use(middleware.auth())
