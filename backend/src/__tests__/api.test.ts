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
    verify: vi.fn().mockResolvedValue(false), // falla por defecto
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
import { db }  from '../db/index';
import argon2  from 'argon2';
import { app } from '../index';

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
// Tests
// =================================================================
describe('Backend API', () => {
  beforeEach(() => {
    // Restaura el comportamiento por defecto antes de cada test
    vi.mocked(db.select).mockImplementation(() => makeChain() as never);
    vi.mocked(argon2.verify).mockResolvedValue(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(db.transaction) as any).mockImplementation(
      async (cb: (tx: unknown) => unknown) => cb(makeTx()),
    );
  });

  // ── Básicos ─────────────────────────────────────────────────────
  it('GET /api/health → 200 con { status: "ok" }', async () => {
    const res  = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/productos → 200 y devuelve array', async () => {
    const res  = await app.request('/api/productos');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // ── Login ───────────────────────────────────────────────────────
  it('POST /api/login con credenciales incorrectas → 401', async () => {
    // db.select devuelve [] → usuario no existe → 401
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

  // ── Register ────────────────────────────────────────────────────
  it('POST /api/register con email inválido → 400', async () => {
    const res = await app.request('/api/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'newuser', password: 'pass1234', email: 'no-es-un-email' }),
    });
    expect(res.status).toBe(400);
  });

  // ── Autorización admin ──────────────────────────────────────────
  it('GET /api/admin/pedidos sin token → 401', async () => {
    const res  = await app.request('/api/admin/pedidos');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/autenticado/i);
  });

  it('GET /api/admin/pedidos con token de usuario standard → 403', async () => {
    // 1. Hacemos login como usuario estándar para obtener un token real en la sesión
    vi.mocked(db.select).mockReturnValueOnce(makeChain([STD_USER]) as never);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);

    const loginRes = await app.request('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'user1', password: 'pass1234' }),
    });
    expect(loginRes.status).toBe(200);
    const { token } = await loginRes.json() as { token: string };

    // 2. Accedemos a la ruta de admin con ese token → debe responder 403
    const res  = await app.request('/api/admin/pedidos', {
      headers: { authorization: token },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/administrador/i);
  });

  // ── Seguridad de precios ────────────────────────────────────────
  it('POST /api/pedidos — el total se calcula con el precio de la BD, no del body', async () => {
    // Precio real en BD: 10.00 €
    const mockProduct = { id: 1, precio: 10.00, stock: 100, nombre: 'Producto Test' };

    // tx.select: primera llamada devuelve el producto; el resto devuelve [] (sin cupón)
    const txSelect = vi.fn()
      .mockReturnValueOnce(makeChain([mockProduct]))
      .mockReturnValue(makeChain([]));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vi.mocked(db.transaction) as any).mockImplementationOnce(
      async (cb: (tx: unknown) => unknown) => cb(makeTx(txSelect)),
    );

    const res = await app.request('/api/pedidos', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      // Aunque un cliente malintencionado envíe un campo "precio", Zod lo elimina del schema.
      // El total siempre debe venir de la BD.
      body: JSON.stringify({
        cliente:   'Cliente Test',
        email:     'cliente@test.com',
        direccion: 'Calle Test 1',
        items:     [{ id: 1, cantidad: 2, precio: 999 }], // precio ignorado
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { subtotal: number; total: number };

    // subtotal = precio_BD (10.00) × cantidad (2) = 20.00
    expect(body.subtotal).toBeCloseTo(20.00, 2);
    // total = subtotal (20) + IVA 21% (4.20) + envío (5.99, porque subtotal < 100) = 30.19
    expect(body.total).toBeCloseTo(30.19, 2);
  });
});
