import { NextRequest, NextResponse } from 'next/server'

/**
 * Rate-limiting middleware — in-memory per-IP, por ventana de 60s.
 * Auth routes: 8 req/min  |  General: 150 req/min
 */

const WINDOW_MS = 60_000

const LIMITS = {
  auth: 8,      // /api/login  /api/register — estricto
  general: 150, // resto de rutas
}

const store = new Map<string, { count: number; resetAt: number }>()

function getIP(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  return (xff ? xff.split(',')[0] : (req.headers.get('x-real-ip') ?? '127.0.0.1')).trim()
}

function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  entry.count++
  return entry.count > limit
}

// Limpia entradas expiradas periódicamente (evita memory leak)
let lastCleanup = Date.now()
function maybeCleanup() {
  const now = Date.now()
  if (now - lastCleanup < 120_000) return
  lastCleanup = now
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k)
  }
}

export function middleware(req: NextRequest) {
  maybeCleanup()

  const ip = getIP(req)
  const { pathname } = req.nextUrl

  const isAuth =
    pathname === '/api/login' ||
    pathname === '/api/register' ||
    pathname.startsWith('/api/login/') ||
    pathname.startsWith('/api/register/')

  const limit = isAuth ? LIMITS.auth : LIMITS.general
  const key = `${isAuth ? 'auth' : 'gen'}:${ip}`

  if (isRateLimited(key, limit)) {
    return NextResponse.json(
      { error: 'Demasiadas peticiones. Espera un momento e inténtalo de nuevo.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil((store.get(key)?.resetAt ?? Date.now()) / 1000)),
        },
      }
    )
  }

  const remaining = Math.max(0, limit - (store.get(key)?.count ?? 0))
  const res = NextResponse.next()
  res.headers.set('X-RateLimit-Limit', String(limit))
  res.headers.set('X-RateLimit-Remaining', String(remaining))
  return res
}

export const config = {
  // Solo aplica a rutas /api/* — excluye assets estáticos
  matcher: ['/api/:path*'],
}
