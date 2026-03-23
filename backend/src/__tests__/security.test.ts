/**
 * ============================================================
 *  SUITE DE SEGURIDAD — Kratamex API
 * ============================================================
 *  Comprueba que la API implementa los controles de seguridad
 *  mínimos exigibles a una aplicación web en producción.
 *
 *  Algunos tests FALLAN intencionadamente: documentan una
 *  vulnerabilidad real que aún no está resuelta en el código.
 *  El mensaje de fallo explica el riesgo y la corrección.
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =================================================================
// Mocks — misma infraestructura que api.test.ts
// =================================================================

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

import { db } from '../db/index';
import argon2   from 'argon2';
import { app }  from '../index';

// =================================================================
// Fixtures
// =================================================================
const MOCK_USER = {
  id: 1, username: 'admin', password: '$argon2id$mock', role: 'admin',
  avatar: null, nombre: 'Admin', email: 'admin@test.com',
  idioma: 'es', telefono: null, direccion: null, activo: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper: obtiene una respuesta de cualquier endpoint para inspeccionar cabeceras
async function getAnyResponse(): Promise<Response> {
  return app.request('/api/productos', { method: 'GET' });
}

// =================================================================
// 1. CABECERAS DE SEGURIDAD HTTP
// =================================================================
describe('Cabeceras de seguridad HTTP', () => {

  it('✅ X-Content-Type-Options: nosniff — previene MIME sniffing', async () => {
    const res = await getAnyResponse();
    expect(
      res.headers.get('X-Content-Type-Options'),
      [
        '',
        '❌ FALLO — X-Content-Type-Options no está presente.',
        '',
        '  RIESGO: Sin esta cabecera el navegador puede "adivinar" el tipo MIME de',
        '  una respuesta y ejecutar como script un fichero que debería ser imagen.',
        '  Esta técnica (MIME sniffing) puede llevar a XSS en recursos subidos por',
        '  usuarios.',
        '',
        '  CORRECCIÓN: Añadir en el middleware de cabeceras de index.ts:',
        "    c.res.headers.set('X-Content-Type-Options', 'nosniff')",
      ].join('\n'),
    ).toBe('nosniff');
  });

  it('✅ X-Frame-Options: DENY — protege contra Clickjacking', async () => {
    const res = await getAnyResponse();
    expect(
      res.headers.get('X-Frame-Options'),
      [
        '',
        '❌ FALLO — X-Frame-Options no está presente.',
        '',
        '  RIESGO: Sin esta cabecera la web puede ser incrustada dentro de un',
        '  <iframe> en otro dominio. Un atacante puede superponer elementos invisibles',
        '  para engañar al usuario y que haga clic en acciones no deseadas',
        '  (Clickjacking). Ejemplo real: robo de sesión o compras no autorizadas.',
        '',
        '  CORRECCIÓN: Añadir en el middleware de cabeceras:',
        "    c.res.headers.set('X-Frame-Options', 'DENY')",
      ].join('\n'),
    ).toBe('DENY');
  });

  it('✅ Sin cabecera X-Powered-By — oculta tecnología del servidor', async () => {
    const res = await getAnyResponse();
    expect(
      res.headers.get('X-Powered-By'),
      [
        '',
        '❌ FALLO — X-Powered-By sigue presente en la respuesta.',
        '',
        '  RIESGO: Exponer el framework o versión (p.ej. "Express/4.18") facilita',
        '  la enumeración de tecnologías al atacante. Con esa información puede',
        '  buscar CVEs específicos y dirigir exploits concretos.',
        '',
        '  CORRECCIÓN: Eliminar la cabecera en el middleware:',
        "    c.res.headers.delete('X-Powered-By')",
      ].join('\n'),
    ).toBeNull();
  });

  // ------------------------------------------------------------------
  //  ❌ TESTS QUE FALLAN — vulnerabilidades pendientes de implementar
  // ------------------------------------------------------------------

  it('❌ [PENDIENTE] Content-Security-Policy — previene XSS e inyección de recursos', async () => {
    const res = await getAnyResponse();
    expect(
      res.headers.get('Content-Security-Policy'),
      [
        '',
        '❌ FALLO — Content-Security-Policy (CSP) no está configurada.',
        '',
        '  RIESGO: Sin CSP el navegador cargará cualquier script, imagen o iframe',
        '  independientemente de su origen. Si un atacante logra inyectar código',
        '  HTML (XSS) podrá ejecutar scripts arbitrarios, robar cookies/tokens,',
        '  redirigir al usuario a phishing o registrar pulsaciones de teclado.',
        '  OWASP Top 10: A03 — Injection / A05 — Security Misconfiguration.',
        '',
        '  CORRECCIÓN: Añadir en el middleware de cabeceras de index.ts:',
        "    c.res.headers.set(",
        "      'Content-Security-Policy',",
        "      \"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';\"",
        "      + \" img-src 'self' data: https:; connect-src 'self';\"",
        "      + \" font-src 'self'; frame-ancestors 'none';\"",
        "    )",
      ].join('\n'),
    ).not.toBeNull();
  });

  it('❌ [PENDIENTE] Strict-Transport-Security — fuerza conexiones HTTPS', async () => {
    const res = await getAnyResponse();
    expect(
      res.headers.get('Strict-Transport-Security'),
      [
        '',
        '❌ FALLO — Strict-Transport-Security (HSTS) no está presente en la API.',
        '',
        '  RIESGO: Sin HSTS un atacante en la misma red (Man-in-the-Middle) puede',
        '  interceptar la primera petición HTTP antes del redireccionamiento HTTPS.',
        '  Esto expone el token de sesión, credenciales y datos del carrito.',
        '  OWASP Top 10: A02 — Cryptographic Failures.',
        '',
        '  NOTA: Actualmente HSTS solo se aplica en el nginx de producción.',
        '  Para que también lo envíe el servidor Hono (útil en dev/staging):',
        '  Añadir en el middleware de cabeceras de index.ts:',
        "    c.res.headers.set(",
        "      'Strict-Transport-Security',",
        "      'max-age=63072000; includeSubDomains; preload'",
        "    )",
      ].join('\n'),
    ).not.toBeNull();
  });

});

// =================================================================
// 2. ANTI-ENUMERACIÓN EN LOGIN
// =================================================================
describe('Anti-enumeración en el endpoint de login', () => {

  it('✅ Mismo mensaje de error para usuario inexistente y contraseña incorrecta', async () => {
    // Caso 1: usuario no existe (db devuelve array vacío)
    vi.mocked(db.select).mockReturnValueOnce(makeChain([]) as never);
    const resNoUser = await app.request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'noexiste', password: 'cualquiera' }),
    });

    // Caso 2: usuario existe pero contraseña incorrecta
    vi.mocked(db.select).mockReturnValueOnce(makeChain([MOCK_USER]) as never);
    vi.mocked(argon2.verify).mockResolvedValueOnce(false);
    const resBadPass = await app.request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'mala' }),
    });

    const bodyNoUser  = await resNoUser.json()  as { error: string };
    const bodyBadPass = await resBadPass.json() as { error: string };

    expect(
      resNoUser.status,
      [
        '',
        '❌ FALLO — El endpoint devuelve HTTP distinto para usuario inexistente.',
        '',
        '  RIESGO: Si el código de estado o el mensaje difiere entre "usuario no',
        '  existe" y "contraseña incorrecta", un atacante puede enumerar usuarios',
        '  válidos mediante fuerza bruta. Con esa lista puede dirigir ataques de',
        '  credential stuffing usando contraseñas filtradas en breaches públicos.',
        '  OWASP Top 10: A07 — Identification and Authentication Failures.',
        '',
        '  CORRECCIÓN: Devolver siempre el mismo status (401) y el mismo mensaje',
        "  ('Credenciales incorrectas') independientemente del motivo del fallo.",
      ].join('\n'),
    ).toBe(401);

    expect(
      resBadPass.status,
      '❌ FALLO — Contraseña incorrecta no devuelve 401.',
    ).toBe(401);

    expect(
      bodyNoUser.error,
      [
        '',
        '❌ FALLO — Mensaje de error diferente para usuario inexistente.',
        '',
        '  RIESGO: Un mensaje específico ("usuario no existe" vs "contraseña',
        '  incorrecta") permite enumerar qué usernames son válidos.',
        '',
        '  CORRECCIÓN: Usar siempre el mismo texto genérico, p.ej.:',
        "    return c.json({ error: 'Credenciales incorrectas' }, 401)",
      ].join('\n'),
    ).toBe(bodyBadPass.error);
  });

});

// =================================================================
// 3. DATOS SENSIBLES EN RESPUESTAS
// =================================================================
describe('Datos sensibles en respuestas de la API', () => {

  it('✅ El login no devuelve el hash de la contraseña', async () => {
    vi.mocked(db.select).mockReturnValueOnce(makeChain([MOCK_USER]) as never);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true);

    const res  = await app.request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' }),
    });
    const body = await res.json() as Record<string, unknown>;
    const raw  = JSON.stringify(body);

    expect(
      raw.includes('$argon2'),
      [
        '',
        '❌ FALLO — La respuesta de login contiene el hash de la contraseña.',
        '',
        '  RIESGO: Aunque Argon2 es resistente a ataques offline, exponer el hash',
        '  en la respuesta de la API facilita ataques de diccionario locales y',
        '  revela que se usa Argon2 (información útil para un atacante).',
        '  OWASP Top 10: A02 — Cryptographic Failures.',
        '',
        '  CORRECCIÓN: En el endpoint /api/login nunca incluir el campo `password`',
        '  en el objeto `user` de la respuesta JSON.',
      ].join('\n'),
    ).toBe(false);
  });

});

// =================================================================
// 4. CORS — rechazo de orígenes no autorizados
// =================================================================
describe('Política CORS', () => {

  it('✅ Rechaza orígenes externos no autorizados', async () => {
    const res = await app.request('/api/productos', {
      method: 'GET',
      headers: { Origin: 'https://attacker.evil.com' },
    });

    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');

    expect(
      allowOrigin === 'https://attacker.evil.com' || allowOrigin === '*',
      [
        '',
        '❌ FALLO — CORS acepta cualquier origen (Access-Control-Allow-Origin: *).',
        '',
        '  RIESGO: Con CORS abierto, cualquier web maliciosa puede hacer peticiones',
        '  autenticadas a la API desde el navegador de la víctima, leyendo datos',
        '  privados (pedidos, perfil, dirección) o realizando acciones en su nombre',
        '  (Cross-Site Request Forgery via fetch con credentials).',
        '  OWASP Top 10: A01 — Broken Access Control.',
        '',
        '  CORRECCIÓN: Restringir los orígenes permitidos en la config de CORS:',
        '    origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null',
        '  Asegurarse de que ALLOWED_ORIGINS no contiene wildcards.',
      ].join('\n'),
    ).toBe(false);
  });

});
