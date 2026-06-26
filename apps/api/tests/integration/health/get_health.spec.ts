import { test } from '@japa/runner'

test.group('Health check', () => {
  test('reports the application as healthy', async ({ client }) => {
    const response = await client.get('/health')

    response.assertStatus(200)
  })
})
