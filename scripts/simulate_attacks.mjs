/**
 * simulate_attacks.mjs
 * Simula distintos tipos de ataques contra la API para poblar el panel SOC.
 *
 * Uso:  node scripts/simulate_attacks.mjs [URL] [ADMIN_PASS]
 * Ej:   node scripts/simulate_attacks.mjs http://localhost:3000 miPassword
 *
 * Requiere Node 18+ (fetch nativo).
 */

import { randomInt, randomBytes } from 'node:crypto';

const BASE       = process.argv[2] ?? 'http://localhost:3000';
const ADMIN_PASS = process.argv[3] ?? 'admin';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd   = (min, max) => randomInt(min, max + 1);
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

const ok   = (m) => process.stdout.write(`  \x1b[32mâœ“\x1b[0m ${m}\n`);
const warn = (m) => process.stdout.write(`  \x1b[33m!\x1b[0m ${m}\n`);
const hdr  = (m) => console.log(`\n\x1b[36mâ–¸ ${m}\x1b[0m`);

async function loginOK() {
  hdr('Login exitoso como admin');
  const r = await POST('/api/login',
    { username: 'admin', password: ADMIN_PASS },
    { 'User-Agent': UAS[0], 'X-Forwarded-For': fakeIP() }
  );
  if (r.status === 200) {
    ok(`login_ok â†’ token ${r.data.token?.slice(0,12)}...`);
    return r.data.token;
  }
  warn(`ERROR ${r.status} â€“ ${JSON.stringify(r.data)} â€” Prueba: node scripts/simulate_attacks.mjs <url> <password>`);
  return null;
}

async function loginFails(n = 18) {
  hdr(`${n} fallos de login (IPs variadas)`);
  const users = ['admin', 'root', 'administrator', 'superuser', 'test', 'user1', 'demo', 'guest'];
  for (let i = 0; i < n; i++) {
    const ua  = UAS[i % UAS.length];
    const usr = users[i % users.length];
    const r   = await POST('/api/login',
      { username: usr, password: `badpass_${randomBytes(3).toString('hex')}` },
      { 'User-Agent': ua, 'X-Forwarded-For': fakeIP() }
    );
    if ([401, 429, 403].includes(r.status)) ok(`${usr.padEnd(14)} â†’ ${r.status}`);
    else warn(`${usr.padEnd(14)} â†’ ${r.status}`);
    await sleep(rnd(60, 140));
  }
}

async function bruteForceOneIP(ip = fakeIP(), n = 14) {
  hdr(`Bruteforce desde una sola IP (${ip})`);
  for (let i = 0; i < n; i++) {
    const r = await POST('/api/login',
      { username: 'admin', password: `guess${i}` },
      { 'User-Agent': 'Hydra/9.5', 'X-Forwarded-For': ip }
    );
    if ([401, 429, 403].includes(r.status)) ok(`intento #${String(i + 1).padStart(2, '0')} â†’ ${r.status}`);
    else warn(`intento #${i + 1} â†’ ${r.status}`);
    await sleep(120);
  }
}

async function honeypots() {
  hdr('Honeypots / rutas trampa');
  const traps = [
    '/wp-login.php',
    '/wp-admin',
    '/.env',
    '/.git/config',
    '/phpmyadmin',
    '/xmlrpc.php',
  ];
  for (const p of traps) {
    const r = await GET(p, { 'User-Agent': 'Nikto/2.1.6', 'X-Forwarded-For': fakeIP() });
    ok(`${p.padEnd(18)} â†’ ${r.status}`);
    await sleep(90);
  }
}

async function invalidTokens() {
  hdr('Uso de tokens inválidos');
  for (let i = 0; i < 8; i++) {
    const bad = randomBytes(12).toString('hex');
    const r = await GET('/api/admin/pedidos', { Authorization: bad, 'X-Forwarded-For': fakeIP(), 'User-Agent': 'curl/7.88.1' });
    ok(`token ${bad.slice(0,8)}... â†’ ${r.status}`);
    await sleep(70);
  }
}

async function main() {
  console.log('\n=== Kratamex SOC attack simulator ===');
  console.log(`Base: ${BASE}\n`);

  await loginOK();
  await loginFails();
  await bruteForceOneIP();
  await honeypots();
  await invalidTokens();

  console.log('\nListo. Revisa /panel para ver los eventos.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
