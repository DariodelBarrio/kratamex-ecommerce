const API = '/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('kratamex_token')
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: token } : {}
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error de red' }))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('text/csv')) {
    return res.text() as unknown as T
  }
  return res.json()
}

// Auth
export const login = (username: string, password: string, website = '') =>
  request<{ token: string; user: any }>('/login', { method: 'POST', body: JSON.stringify({ username, password, website }) })

export const register = (data: { username: string; password: string; email: string; nombre?: string; website?: string }) =>
  request<{ token: string; user: any }>('/register', { method: 'POST', body: JSON.stringify(data) })

export const getUsuario = () => request<{ user: any }>('/usuario')

export const updatePerfil = (data: Record<string, string>) =>
  request('/usuario/perfil', { method: 'PUT', body: JSON.stringify(data) })

export const cambiarPassword = (passwordActual: string, passwordNueva: string) =>
  request('/usuario/password', { method: 'PUT', body: JSON.stringify({ passwordActual, passwordNueva }) })

// Products
export const getProductos = (params?: string) => {
  const path = params ? `/productos?${params}` : '/productos'
  return request<any[]>(path)
}

export const getProducto = (id: number) => request<any>(`/productos/${id}`)

// Ratings
export const getValoraciones = (productoId: number) =>
  request<any[]>(`/productos/${productoId}/valoraciones`)

export const postValoracion = (productoId: number, data: { puntuacion: number; titulo?: string; comentario?: string }) =>
  request(`/productos/${productoId}/valoraciones`, { method: 'POST', body: JSON.stringify(data) })

// Orders
export const getMisPedidos = () => request<any[]>('/mis-pedidos')

export const postPedido = (data: any) =>
  request('/pedidos', { method: 'POST', body: JSON.stringify(data) })

// Favorites
export const getFavoritos = () => request<any[]>('/favoritos')
export const addFavorito = (productoId: number) =>
  request(`/favoritos/${productoId}`, { method: 'POST' })
export const removeFavorito = (productoId: number) =>
  request(`/favoritos/${productoId}`, { method: 'DELETE' })

// Coupons
export const validarCupon = (codigo: string, subtotal: number) =>
  request<{ valido: boolean; descuento: number; tipo: string; valor: number }>('/cupones/validar', { method: 'POST', body: JSON.stringify({ codigo, subtotal }) })

// Categories
export const getCategorias = () => request<any[]>('/categorias')

// Admin
export const getAdminPedidos = (limit = 100, offset = 0) =>
  request<any[]>(`/admin/pedidos?limit=${limit}&offset=${offset}`)

export const patchPedidoEstado = (id: number, estado: string, notas?: string) =>
  request(`/pedidos/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado, notas }) })

export const getAdminAnalytics = () => request<any>('/admin/analytics')

export const getAdminUsuarios = () => request<any[]>('/admin/usuarios')

export const getAdminCupones = () => request<any[]>('/admin/cupones')

export const postAdminCupon = (data: any) =>
  request('/admin/cupones', { method: 'POST', body: JSON.stringify(data) })

export const deleteAdminCupon = (id: number) =>
  request(`/admin/cupones/${id}`, { method: 'DELETE' })

export const postProducto = (data: any) =>
  request('/productos', { method: 'POST', body: JSON.stringify(data) })

export const putProducto = (id: number, data: any) =>
  request(`/productos/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteProducto = (id: number) =>
  request(`/productos/${id}`, { method: 'DELETE' })

export const patchProductoStock = (id: number, data: { stock?: number; activo?: boolean }) =>
  request(`/productos/${id}/stock`, { method: 'PATCH', body: JSON.stringify(data) })

export const getAuditLog = (limit = 200) =>
  request<any[]>(`/admin/audit-log?limit=${limit}`)

export const exportPedidosCsv = () =>
  fetch(`${API}/admin/pedidos/csv`, { headers: authHeaders() }).then(r => r.text())

// 2FA
export const getTwoFactorStatus = () => request<{ enabled: boolean }>('/2fa/status')

export const setupTwoFactor = () =>
  request<{ secret: string; qr: string }>('/2fa/setup', { method: 'POST' })

export const enableTwoFactor = (code: string) =>
  request<{ success: boolean }>('/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) })

export const disableTwoFactor = (code: string) =>
  request<{ success: boolean }>('/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) })

export const verifyTwoFactor = (code: string) =>
  request<{ success: boolean }>('/2fa/verify', { method: 'POST', body: JSON.stringify({ code }) })
