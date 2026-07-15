import { HttpResponse, http } from 'msw'

const API_BASE_URL = 'http://localhost:3333'

export const handlers = [
  http.get(`${API_BASE_URL}/auth/me`, () =>
    HttpResponse.json(
      { error: { code: 'E_UNAUTHORIZED_ACCESS', message: 'Invalid or expired user session' } },
      { status: 401 },
    ),
  ),

  http.post(`${API_BASE_URL}/auth/login`, () =>
    HttpResponse.json(
      { error: { code: 'E_LOGIN_INVALID_CREDENTIALS', message: 'Invalid credentials' } },
      { status: 401 },
    ),
  ),

  http.post(`${API_BASE_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
]
