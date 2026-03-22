import { describe, it, expect, vi } from 'vitest';

// =================================================================
// Mocks — hoisted before any real imports by Vitest
// =================================================================

// Chainable + thenable Drizzle query mock
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

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
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

// Import app AFTER mocks so module-level code uses the fakes
import { app } from '../index';

// =================================================================
// Tests
// =================================================================

describe('Backend API — tests básicos', () => {
  it('GET /api/health → 200 con { status: "ok" }', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /api/productos → 200 y devuelve array', async () => {
    const res = await app.request('/api/productos');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('POST /api/login con credenciales incorrectas → 401', async () => {
    const res = await app.request('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'noexiste', password: 'wrongpass' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Credenciales incorrectas');
  });

  it('GET /api/admin/pedidos sin token → 401', async () => {
    const res = await app.request('/api/admin/pedidos');
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/autenticado/i);
  });
});
