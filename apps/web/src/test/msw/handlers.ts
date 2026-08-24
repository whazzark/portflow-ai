import { HttpResponse, http } from 'msw'

const API_BASE_URL = 'http://localhost:3333'

export const handlers = [
  http.get(`${API_BASE_URL}/api/v1/auth/me`, () =>
    HttpResponse.json(
      { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' } },
      { status: 401 },
    ),
  ),

  http.post(`${API_BASE_URL}/api/v1/auth/login`, () =>
    HttpResponse.json(
      { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
      { status: 401 },
    ),
  ),

  http.post(`${API_BASE_URL}/api/v1/auth/logout`, () => new HttpResponse(null, { status: 204 })),

  http.get(`${API_BASE_URL}/api/v1/transport-companies`, () =>
    HttpResponse.json({
      data: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Atlantic Transport',
          contactPhone: '+33 2 40 12 34 56',
          contactEmail: 'dispatch@atlantic-transport.test',
          status: 'AVAILABLE',
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Bêta Logistique',
          contactPhone: '02.96.45.67.89',
          contactEmail: 'contact@beta-logistique.test',
          status: 'AVAILABLE',
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          name: 'Coastal Haulage',
          contactPhone: '+44 20 7946 0958',
          contactEmail: 'ops@coastal-haulage.test',
          status: 'ARCHIVED',
        },
      ],
    }),
  ),

  http.get(`${API_BASE_URL}/api/v1/docks`, () =>
    HttpResponse.json(
      { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' } },
      { status: 401 },
    ),
  ),

  http.get(`${API_BASE_URL}/api/v1/warehouses`, () =>
    HttpResponse.json(
      { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' } },
      { status: 401 },
    ),
  ),
]
