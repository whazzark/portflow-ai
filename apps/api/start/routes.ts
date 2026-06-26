import router from '@adonisjs/core/services/router'
import { controllers } from '#generated/controllers'

router.get('/health', [controllers.Health, 'show']).as('health.show')
