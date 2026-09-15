import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'
import { middleware } from '#start/kernel'

router.get('/health', [controllers.Health, 'show']).as('health.show')

router.post('/api/v1/auth/login', [controllers.Login, 'store']).as('auth.login')

// Public, like login: the activation link is the only proof the invited person presents. Both
// routes read the secret from the body — never a path parameter, which access logs would record.
router
  .post('/api/v1/auth/invitation-acceptance/preview', [controllers.InvitationAcceptance, 'preview'])
  .as('auth.invitation_acceptance.preview')
router
  .post('/api/v1/auth/invitation-acceptance', [controllers.InvitationAcceptance, 'store'])
  .as('auth.invitation_acceptance.store')

router
  .group(() => {
    router
      .group(() => {
        router.get('/me', [controllers.Me, 'show']).as('me')
        router.post('/logout', [controllers.Logout, 'destroy']).as('logout')
        router
          .post('/password-renewal', [controllers.PasswordRenewal, 'store'])
          .as('password_renewal')
      })
      .prefix('/auth')
      .as('auth')

    router
      .group(() => {
        // The signed-in user's own profile. Declared here, behind the renewal gate, rather than in
        // the `/auth` group beside `me`: a user who owes a new password updates nothing else first,
        // and they renew it through `/auth/password-renewal`, which asks for no current password.
        router.patch('/me/profile', [controllers.OwnProfile, 'update']).as('me.profile.update')
        router
          .patch('/me/password', [controllers.OwnProfile, 'changePassword'])
          .as('me.password.update')

        router
          .group(() => {
            router.post('/', [controllers.Customers, 'store']).as('store')
            router.get('/', [controllers.Customers, 'index']).as('index')
            router.get('/available', [controllers.Customers, 'available']).as('available')
            router.post('/archive', [controllers.Customers, 'archiveMany']).as('archive_many')
            router
              .post('/reactivate', [controllers.Customers, 'reactivateMany'])
              .as('reactivate_many')
            router.patch('/:id', [controllers.Customers, 'update']).as('update')
            router.post('/:id/archive', [controllers.Customers, 'archive']).as('archive')
            router.post('/:id/reactivate', [controllers.Customers, 'reactivate']).as('reactivate')
          })
          .prefix('/customers')
          .as('customers')

        router
          .group(() => {
            router.post('/', [controllers.TransportCompanies, 'store']).as('store')
            router.get('/', [controllers.TransportCompanies, 'index']).as('index')
            router.get('/available', [controllers.TransportCompanies, 'available']).as('available')
            router.patch('/:id', [controllers.TransportCompanies, 'update']).as('update')
            router
              .post('/archive', [controllers.TransportCompanies, 'archiveMany'])
              .as('archive_many')
            router
              .post('/reactivate', [controllers.TransportCompanies, 'reactivateMany'])
              .as('reactivate_many')
            router.post('/:id/archive', [controllers.TransportCompanies, 'archive']).as('archive')
            router
              .post('/:id/reactivate', [controllers.TransportCompanies, 'reactivate'])
              .as('reactivate')
          })
          .prefix('/transport-companies')
          .as('transport_companies')

        router
          .group(() => {
            router.get('/', [controllers.Trucks, 'index']).as('index')
            router.get('/available', [controllers.Trucks, 'available']).as('available')
            router.get('/suspended', [controllers.Trucks, 'suspended']).as('suspended')
            router.post('/', [controllers.Trucks, 'store']).as('store')
            router.patch('/:id', [controllers.Trucks, 'update']).as('update')
            router.post('/archive', [controllers.Trucks, 'archiveMany']).as('archive_many')
            router.post('/:id/archive', [controllers.Trucks, 'archive']).as('archive')
            router.post('/reactivate', [controllers.Trucks, 'reactivateMany']).as('reactivate_many')
            router.post('/:id/reactivate', [controllers.Trucks, 'reactivate']).as('reactivate')
            router.post('/:id/suspend', [controllers.Trucks, 'suspend']).as('suspend')
            router
              .post('/:id/return-to-service', [controllers.Trucks, 'returnToService'])
              .as('return_to_service')
          })
          .prefix('/trucks')
          .as('trucks')

        router
          .group(() => {
            router.get('/', [controllers.Discharges, 'index']).as('index')
            router.post('/', [controllers.Discharges, 'store']).as('store')
            router.get('/:id', [controllers.Discharges, 'show']).as('show')
            router.patch('/:id', [controllers.Discharges, 'update']).as('update')
            router
              .group(() => {
                router.post('/', [controllers.DischargeProductLots, 'store']).as('store')
                router.patch('/:id', [controllers.DischargeProductLots, 'update']).as('update')
                router.delete('/:id', [controllers.DischargeProductLots, 'destroy']).as('destroy')
              })
              .prefix('/:dischargeId/product-lots')
              .as('product_lots')
            router
              .group(() => {
                router
                  .get('/candidates', [controllers.DischargeTruckPool, 'candidates'])
                  .as('candidates')
                router.post('/', [controllers.DischargeTruckPool, 'store']).as('store')
                router
                  .post('/withdrawals', [controllers.DischargeTruckPool, 'withdraw'])
                  .as('withdraw')
              })
              .prefix('/:dischargeId/truck-pool')
              .as('truck_pool')
            router
              .put('/:dischargeId/shifts/:shiftId/trucks', [
                controllers.DischargeShiftTrucks,
                'update',
              ])
              .as('shift_trucks.update')
            // The router matches whole segments, so this never answers `/shifts/:shiftId/trucks`.
            router
              .put('/:dischargeId/shifts/:shiftId', [controllers.DischargeShifts, 'update'])
              .as('shifts.update')
          })
          .prefix('/discharges')
          .as('discharges')

        router
          .group(() => {
            // Declared before every `/:id` route, which would otherwise read the segment as an id.
            router
              .get('/eligible-shift-responsibles', [controllers.Users, 'eligibleShiftResponsibles'])
              .as('eligible_shift_responsibles')
            router.get('/', [controllers.Users, 'index']).as('index')
            router.post('/', [controllers.Users, 'store']).as('store')
            router.patch('/:id', [controllers.Users, 'update']).as('update')
            router.delete('/:id', [controllers.Users, 'destroy']).as('destroy')
            router.post('/:id/deactivate', [controllers.Users, 'deactivate']).as('deactivate')
            router.post('/:id/reactivate', [controllers.Users, 'reactivate']).as('reactivate')
            router
              .post('/:id/cancel-invitation', [controllers.Users, 'cancelInvitation'])
              .as('cancel_invitation')
            router
              .post('/:id/restore-invitation', [controllers.Users, 'restoreInvitation'])
              .as('restore_invitation')
            router.patch('/:id/role', [controllers.Users, 'changeRole']).as('change_role')
            router
              .post('/:id/password-reset', [controllers.Users, 'resetPassword'])
              .as('password_reset')
            router
              .post('/:id/activation-link-renewal', [controllers.Users, 'renewActivationLink'])
              .as('activation_link_renewal')
          })
          .prefix('/users')
          .as('users')

        router
          .group(() => {
            router.get('/', [controllers.Docks, 'index']).as('index')
            router.post('/', [controllers.Docks, 'store']).as('store')
            router.get('/available', [controllers.Docks, 'available']).as('available')
            router.patch('/:id', [controllers.Docks, 'update']).as('update')
            router.post('/archive', [controllers.Docks, 'archiveMany']).as('archive_many')
            router.post('/:id/archive', [controllers.Docks, 'archive']).as('archive')
            router.post('/reactivate', [controllers.Docks, 'reactivateMany']).as('reactivate_many')
            router.post('/:id/reactivate', [controllers.Docks, 'reactivate']).as('reactivate')
          })
          .prefix('/docks')
          .as('docks')

        router
          .group(() => {
            router.get('/', [controllers.WeighingAreas, 'index']).as('index')
            router.post('/', [controllers.WeighingAreas, 'store']).as('store')
            router.get('/available', [controllers.WeighingAreas, 'available']).as('available')
            router.patch('/:id', [controllers.WeighingAreas, 'update']).as('update')
            router.post('/archive', [controllers.WeighingAreas, 'archiveMany']).as('archive_many')
            router.post('/:id/archive', [controllers.WeighingAreas, 'archive']).as('archive')
            router
              .post('/reactivate', [controllers.WeighingAreas, 'reactivateMany'])
              .as('reactivate_many')
            router
              .post('/:id/reactivate', [controllers.WeighingAreas, 'reactivate'])
              .as('reactivate')
          })
          .prefix('/weighing-areas')
          .as('weighing_areas')

        router
          .group(() => {
            router.post('/', [controllers.WarehouseDoors, 'store']).as('store')
            router.get('/available', [controllers.WarehouseDoors, 'available']).as('available')
            router.patch('/:id', [controllers.WarehouseDoors, 'update']).as('update')
            // Declared before `/:id/archive`, or `/warehouse-doors/archive` resolves as
            // `:id = 'archive'`.
            router.post('/archive', [controllers.WarehouseDoors, 'archiveMany']).as('archive_many')
            router.post('/:id/archive', [controllers.WarehouseDoors, 'archive']).as('archive')
            router
              .post('/:id/reactivate', [controllers.WarehouseDoors, 'reactivate'])
              .as('reactivate')
          })
          .prefix('/warehouse-doors')
          .as('warehouse_doors')

        router
          .group(() => {
            router.get('/', [controllers.Warehouses, 'index']).as('index')
            router.post('/', [controllers.Warehouses, 'store']).as('store')
            router.patch('/:id', [controllers.Warehouses, 'update']).as('update')
            // Declared before `/:id/archive`, or `/warehouses/archive` resolves as `:id = 'archive'`.
            router.post('/archive', [controllers.Warehouses, 'archiveMany']).as('archive_many')
            router.post('/:id/archive', [controllers.Warehouses, 'archive']).as('archive')
            // Same ordering constraint: `/warehouses/reactivate` must not resolve as
            // `:id = 'reactivate'`.
            router
              .post('/reactivate', [controllers.Warehouses, 'reactivateMany'])
              .as('reactivate_many')
            router.post('/:id/reactivate', [controllers.Warehouses, 'reactivate']).as('reactivate')
          })
          .prefix('/warehouses')
          .as('warehouses')
      })
      .use(middleware.passwordRenewalCompleted())
  })
  .prefix('/api/v1')
  .use(middleware.auth())
