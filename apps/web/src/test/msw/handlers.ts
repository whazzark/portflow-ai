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
          status: 'AVAILABLE',
        },
        {
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Bêta Logistique',
          status: 'AVAILABLE',
        },
        { id: '00000000-0000-4000-8000-000000000003', name: 'Coastal Haulage', status: 'ARCHIVED' },
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
