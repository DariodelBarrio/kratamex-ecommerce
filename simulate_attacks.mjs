/**
 * simulate_attacks.mjs
 * Simula distintos tipos de ataques contra la API para poblar el panel SOC.
 *
 * Uso:  node simulate_attacks.mjs [URL] [ADMIN_PASS]
 * Ej:   node simulate_attacks.mjs http://localhost:3000 miPassword
 *
 * Requiere Node 18+ (fetch nativo).
 */

const BASE       = process.argv[2] ?? 'http://localhost:3000';
const ADMIN_PASS = process.argv[3] ?? 'admin';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const fakeIP = () => `${rnd(1,254)}.${rnd(0,254)}.${rnd(0,254)}.${rnd(0,254)}`;

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0 Safari/537.36',
  'python-requests/2.31.0',
  'curl/7.88.1',
  'Hydra/9.5 (hydra-2.3)',
  'sqlmap/1.8.5#stable',
  'Nikto/2.1.6 (Evasions:None)',
  'Go-http-client/1.1',
  'masscan/1.3.2',
];

async function POST(path, body, extra = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extra },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch (e) { return { status: 0, error: e.message }; }
}

async function GET(path, extra = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: extra });
    return { status: res.status };
  } catch (e) { return { status: 0, error: e.message }; }
}

const ok   = (m) => process.stdout.write(`  \x1b[32m✓\x1b[0m ${m}\n`);
const warn = (m) => process.stdout.write(`  \x1b[33m!\x1b[0m ${m}\n`);
const hdr  = (m) => console.log(`\n\x1b[36m▸ ${m}\x1b[0m`);

// ──────────────────────────────────────────────────────────────────────────────
// 1. LOGIN EXITOSO (antes de cualquier bloqueo)
// ──────────────────────────────────────────────────────────────────────────────
async function loginOK() {
  hdr('Login exitoso como admin');
  const r = await POST('/api/login',
    { username: 'admin', password: ADMIN_PASS },
    { 'User-Agent': UAS[0], 'X-Forwarded-For': fakeIP() }
  );
  if (r.status === 200) {
    ok(`login_ok → token ${r.data.token?.slice(0,12)}...`);
    return r.data.token;
  }
  warn(`ERROR ${r.status} – ${JSON.stringify(r.data)} — Prueba: node simulate_attacks.mjs <url> <password>`);
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. FALLOS DE LOGIN desde IPs distintas
// ──────────────────────────────────────────────────────────────────────────────
async function loginFails(n = 18) {
  hdr(`${n} fallos de login (IPs variadas)`);
  const users = ['admin', 'root', 'administrator', 'superuser', 'test', 'user1', 'demo', 'guest'];
  for (let i = 0; i < n; i++) {
    const ua  = UAS[i % UAS.length];
    const usr = users[i % users.length];
    const r   = await POST('/api/login',
      { username: usr, password: `badpass_${Math.random().toString(36).slice(2,8)}` },
      { 'User-Agent': ua, 'X-Forwarded-For': fakeIP() }
    );
    const icon = r.status === 401 ? '✗' : r.status === 429 ? '⛔' : '?';
    ok(`login_fail ${icon} #${i+1} user=${usr.padEnd(15)} HTTP ${r.status}`);
    await sleep(80);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. BRUTE FORCE — misma IP, 13 intentos rápidos
// ──────────────────────────────────────────────────────────────────────────────
async function bruteForce() {
  const ip = fakeIP();
  hdr(`Brute force desde IP fija ${ip}`);
  const passwords = [
    'password','123456','admin','letmein','qwerty','admin123',
    'password1','abc123','111111','1234567','dragon','master','pass@123',
  ];
  for (let i = 0; i < 13; i++) {
    const r = await POST('/api/login',
      { username: 'admin', password: passwords[i % passwords.length] },
      { 'User-Agent': 'Hydra/9.5 (hydra-2.3)', 'X-Forwarded-For': ip }
    );
    const tag = r.status === 429 ? '⛔ BLOCKED' : `✗ HTTP ${r.status}`;
    ok(`brute #${i+1} ${tag}${r.data?.error ? ' – ' + r.data.error : ''}`);
    await sleep(50);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. TOKENS INVÁLIDOS
// ──────────────────────────────────────────────────────────────────────────────
async function invalidTokens(n = 12) {
  hdr(`${n} tokens inválidos a rutas protegidas`);
  const paths = [
    '/api/usuario', '/api/admin/productos', '/api/admin/pedidos',
    '/api/security/stats', '/api/mis-pedidos', '/api/admin/valoraciones',
  ];
  for (let i = 0; i < n; i++) {
    const fake  = Math.random().toString(36).repeat(4).slice(2, 66);
    const path  = paths[i % paths.length];
    const r     = await GET(path, {
      'Authorization': fake,
      'User-Agent': UAS[i % UAS.length],
      'X-Forwarded-For': fakeIP(),
    });
    ok(`auth_invalid #${i+1} → ${path.padEnd(32)} HTTP ${r.status}`);
    await sleep(70);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. ESCANEO de rutas sensibles (genera auth_invalid en endpoints varios)
// ──────────────────────────────────────────────────────────────────────────────
async function scanEndpoints() {
  const scanner = fakeIP();
  hdr(`Escaneo de rutas sensibles desde ${scanner}`);
  const targets = [
    '/api/admin/usuarios', '/.env', '/api/admin/settings',
    '/api/v1/admin', '/phpMyAdmin', '/wp-admin',
    '/api/debug', '/api/admin/logs', '/api/admin/backup',
  ];
  for (const p of targets) {
    const r = await GET(p, {
      'User-Agent': 'Nikto/2.1.6 (Evasions:None)',
      'X-Forwarded-For': scanner,
      'Authorization': 'scanner_fake_token',
    });
    ok(`scan → ${p.padEnd(35)} HTTP ${r.status}`);
    await sleep(60);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. SEGUNDO brute force desde otra IP (para más datos en el chart)
// ──────────────────────────────────────────────────────────────────────────────
async function bruteForce2() {
  const ip = fakeIP();
  hdr(`Segundo brute force desde ${ip}`);
  for (let i = 0; i < 13; i++) {
    const r = await POST('/api/login',
      { username: 'root', password: `pass${i}` },
      { 'User-Agent': 'python-requests/2.31.0', 'X-Forwarded-For': ip }
    );
    ok(`brute2 #${i+1} HTTP ${r.status}`);
    await sleep(50);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log(`\x1b[31m╔═══════════════════════════════════════════════╗`);
  console.log(`║  KRATAMEX SOC — Simulador de ataques           ║`);
  console.log(`║  Target : ${BASE.padEnd(36)}║`);
  console.log(`╚═══════════════════════════════════════════════╝\x1b[0m`);

  const token = await loginOK();
  await sleep(200);

  await loginFails(18);
  await sleep(200);

  await bruteForce();
  await sleep(200);

  await invalidTokens(12);
  await sleep(200);

  await scanEndpoints();
  await sleep(200);

  await bruteForce2();

  console.log(`\n\x1b[32m╔═══════════════════════════════════════════════╗`);
  console.log(`║  ✓ Simulación completada                       ║`);
  console.log(`║  Abre /panel y refresca para ver los eventos   ║`);
  console.log(`╚═══════════════════════════════════════════════╝\x1b[0m\n`);

  if (!token) {
    console.log(`\x1b[33mNOTA: El login_ok falló. Ejecuta así si tu contraseña no es "admin":\x1b[0m`);
    console.log(`  node simulate_attacks.mjs ${BASE} <tu_contraseña>\n`);
  }
})();
