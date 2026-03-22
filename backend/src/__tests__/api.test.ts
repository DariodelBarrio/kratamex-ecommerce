import { describe, it, expect, vi, beforeEach } from 'vitest';

// =================================================================
// Mocks — hoisted antes de cualquier import real
// =================================================================

/** Cadena Drizzle chainable + thenable que resuelve a `value` */
function makeChain(value: unknown[] = []) {
  const p = Promise.resolve(value);
  const q: Record<string, unknown> & { then: typeof p.then; catch: typeof p.catch } = {
    then:  p.then.bind(p),
    catch: p.catch.bind(p),
  };
  for (const m of ['from','where','orderBy','limit','offset','groupBy','leftJoin','innerJoin','having']) {
    (q as Record<string, unknown>)[m] = vi.fn(() => q);
  }
  return q;
}

/** Objeto que simula un tx de Drizzle dentro de db.transaction */
function makeTx(selectOverride?: ReturnType<typeof vi.fn>) {
  return {
    select: selectOverride ?? vi.fn(() => makeChain()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
  };
}

vi.mock('../db/index', () => ({
  db: {
    select:      vi.fn(() => makeChain()),
    insert:      vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })) })),
    update:      vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete:      vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(makeTx())),
  },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    end:   vi.fn(),
  },
}));

vi.mock('argon2', () => ({
  default: {
    hash:   vi.fn().mockResolvedValue('$argon2id$mock'),
    verify: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('stripe', () => ({
  default: class {
    paymentIntents = { create: vi.fn() };
    webhooks       = { constructEvent: vi.fn() };
  },
}));

vi.mock('cloudinary', () => ({
  v2: { config: vi.fn(), uploader: { upload_stream: vi.fn() } },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
    })),
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    appendFile:    vi.fn((_p: unknown, _d: unknown, cb?: (e: null) => void) => cb?.(null)),
    existsSync:    vi.fn(() => false),
    mkdirSync:     vi.fn(),
    writeFileSync: vi.fn(),
  };
});

// ── importamos los mocks para manipularlos en cada test ──
import { db, pool } from '../db/index';
import argon2       from 'argon2';
import { app }      from '../index';

// =================================================================
// Fixtures de usuario
// =================================================================
const ADMIN_USER = {
  id: 1, username: 'admin', password: '$argon2id$mock', role: 'admin',
  avatar: null, nombre: 'Admin', email: 'admin@test.com',
  idioma: 'es', telefono: null, direccion: null, activo: true,
};
const STD_USER = {
  id: 2, username: 'user1', password: '$argon2id$mock', role: 'standard',
  avatar: null, nombre: 'User', email: 'user@test.com',
  idioma: 'es', telefono: null, direccion: null, activo: true,
};

// =================================================================
// Helper: hace login y devuelve el token de sesión
// =================================================================
async function loginAs(user: typeof ADMIN_USER | typeof STD_USER): Promise<string> {
  vi.mocked(db.select).mockReturnValueOnce(makeChain([user]) as never);
  vi.mocked(argon2.verify).mockResolvedValueOnce(true);
  const res  = await app.request('/api/login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ username: user.username, password: 'testpass' }),
  });
  const json = await res.json() as { token: string };
  return json.token;
}

// =================================================================
// Tests
// =================================================================
describe('Backend API', () => {
  beforeEach(() => {
    vi.mocked(db.select).mockImplementation(() => makeChain() as never);
    vi.mocked(argon2.verify).mockResolvedValue(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(db.transaction) as any).mockImplementation(
      async (cb: (tx: unknown) => unknown) => cb(makeTx()),
    );
  });

  // ── Rutas públicas ───────────────────────────────────────────────
  it('GET /api/health → 200 con { status: "ok" }', async () => {
    const res  = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/productos → 200 y devuelve array', async () => {
    const res  = await app.request('/api/productos');
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('GET /api/categorias → 200 y devuelve array', async () => {
    const res  = await app.request('/api/categorias');
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('GET /api/calcular-costes → IVA y envío estándar cuando subtotal < 100', async () => {
    const res  = await app.request('/api/calcular-costes?subtotal=50');
    expect(res.status).toBe(200);
    const body = await res.json() as { subtotal: number; impuestos: number; envio: number; total: number };
    expect(body.subtotal).toBeCloseTo(50, 2);
    expect(body.impuestos).toBeCloseTo(10.5, 2);   // 50 × 21%
    expect(body.envio).toBeCloseTo(5.99, 2);
    expect(body.total).toBeCloseTo(66.49, 2);
  });

  it('GET /api/calcular-costes → envío gratis cuando subtotal ≥ 100', async () => {
    const res  = await app.request('/api/calcular-costes?subtotal=100');
    expect(res.status).toBe(200);
    const body = await res.json() as { envio: number };
    expect(body.envio).toBe(0);
  });

  // ── Login ───────────────────────────────────────────────────────
  it('POST /api/login con credenciales incorrectas → 401', async () => {
    const res  = await app.request('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'noexiste', password: 'wrongpass' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Credenciales incorrectas');
  });

  it('POST /api/login con credenciales correctas → 200 y token', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeChain([ADMIN_USER]) as never);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);

    const res  = await app.request('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; token: string };
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(10);
  });

  it('POST /api/login → 429 tras 12 intentos fallidos (rate limiting)', async () => {
    // IP exclusiva para este test (nunca usada en otro test)
    const RATE_IP = '10.0.1.99';
    const headers = { 'Content-Type': 'application/json', 'x-forwarded-for': RATE_IP };
    const body    = JSON.stringify({ username: 'brute', password: 'wrong' });

    // autoBlockIp usa pool.query (raw SQL) para persistir el bloqueo y luego hace
    // blockedIpSet.add(ip). Si pool.query falla, el add no ocurre y el siguiente
    // intento llega al loginRateLimiter (que devuelve 429) en vez del global IP
    // block (que devuelve 403).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pool.query as any).mockRejectedValueOnce(new Error('DB unavailable'));

    // 12 intentos fallidos — db.select devuelve [] → usuario no existe → 401
    for (let i = 0; i < 12; i++) {
      await app.request('/api/login', { method: 'POST', headers, body });
    }

    // El intento 13 no llega al handler: loginRateLimiter detecta blockedUntil → 429
    const res  = await app.request('/api/login', { method: 'POST', headers, body });
    expect(res.status).toBe(429);
    const json = await res.json() as { error: string };
    expect(json.error).toMatch(/intentos|bloqueado|tarde/i);
  });

  // ── Register ────────────────────────────────────────────────────
  it('POST /api/register con email inválido → 400', async () => {
    const res = await app.request('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'newuser', password: 'pass1234', email: 'no-es-un-email' }),
    });
    expect(res.status).toBe(400);
  });

  // ── Sesión ──────────────────────────────────────────────────────
  it('GET /api/usuario con token válido → 200 con datos del usuario', async () => {
    const token = await loginAs(STD_USER);
    const res   = await app.request('/api/usuario', { headers: { authorization: token } });
    expect(res.status).toBe(200);
    const body  = await res.json() as { user: { username: string; role: string } };
    expect(body.user.username).toBe(STD_USER.username);
    expect(body.user.role).toBe('standard');
  });

  it('GET /api/usuario sin token → 401', async () => {
    const res = await app.request('/api/usuario');
    expect(res.status).toBe(401);
  });

  it('POST /api/logout con token → 200', async () => {
    const token = await loginAs(STD_USER);
    const res   = await app.request('/api/logout', {
      method:  'POST',
      headers: { authorization: token },
    });
    expect(res.status).toBe(200);
  });

  it('POST /api/logout sin token → 200 (idempotente)', async () => {
    const res = await app.request('/api/logout', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  // ── Rutas autenticadas de usuario ────────────────────────────────
  it('GET /api/mis-pedidos con token de usuario → 200 y array', async () => {
    const token = await loginAs(STD_USER);
    const res   = await app.request('/api/mis-pedidos', { headers: { authorization: token } });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  // ── Autorización admin ──────────────────────────────────────────
  it('GET /api/admin/pedidos sin token → 401', async () => {
    const res  = await app.request('/api/admin/pedidos');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/autenticado/i);
  });

  it('GET /api/admin/pedidos con token de usuario standard → 403', async () => {
    const token = await loginAs(STD_USER);
    const res   = await app.request('/api/admin/pedidos', { headers: { authorization: token } });
    expect(res.status).toBe(403);
    const body  = await res.json() as { error: string };
    expect(body.error).toMatch(/administrador/i);
  });

  it('GET /api/admin/pedidos con token de admin → 200', async () => {
    const token = await loginAs(ADMIN_USER);
    const res   = await app.request('/api/admin/pedidos', { headers: { authorization: token } });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('GET /api/admin/usuarios con token de admin → 200', async () => {
    const token = await loginAs(ADMIN_USER);
    const res   = await app.request('/api/admin/usuarios', { headers: { authorization: token } });
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('GET /api/security/events con token de admin → 200', async () => {
    const token = await loginAs(ADMIN_USER);
    const res   = await app.request('/api/security/events', { headers: { authorization: token } });
    expect(res.status).toBe(200);
  });

  it('GET /api/security/blocked-ips con token de admin → 200', async () => {
    const token = await loginAs(ADMIN_USER);
    const res   = await app.request('/api/security/blocked-ips', { headers: { authorization: token } });
    expect(res.status).toBe(200);
  });

  // ── Recuperación de contraseña ───────────────────────────────────
  it('POST /api/forgot-password sin email → 400', async () => {
    const res = await app.request('/api/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/forgot-password con email no registrado → 200 (anti-enumeración)', async () => {
    // db.select devuelve [] → email no existe, pero la respuesta es 200 igual
    const res  = await app.request('/api/forgot-password', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: 'noexiste@example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; message: string };
    expect(body.ok).toBe(true);
    expect(body.message).toBeTruthy();
  });

  // ── Seguridad de precios ────────────────────────────────────────
  it('POST /api/pedidos — el total se calcula con el precio de la BD, no del body', async () => {
    const mockProduct = { id: 1, precio: 10.00, stock: 100, nombre: 'Producto Test' };

    const txSelect = vi.fn()
      .mockReturnValueOnce(makeChain([mockProduct]))  // lookup del producto
      .mockReturnValue(makeChain([]));                // lookup de cupón → sin cupón

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(db.transaction) as any).mockImplementationOnce(
      async (cb: (tx: unknown) => unknown) => cb(makeTx(txSelect)),
    );

    const res = await app.request('/api/pedidos', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        cliente:   'Cliente Test',
        email:     'cliente@test.com',
        direccion: 'Calle Test 1',
        items:     [{ id: 1, cantidad: 2, precio: 999 }], // precio ignorado por Zod
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { subtotal: number; total: number };
    // subtotal = precio_BD (10.00) × cantidad (2) = 20.00
    expect(body.subtotal).toBeCloseTo(20.00, 2);
    // total = 20.00 + IVA 21% (4.20) + envío (5.99) = 30.19
    expect(body.total).toBeCloseTo(30.19, 2);
  });
});
