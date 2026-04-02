/*
=================================================================
KRATAMEX — BACKEND v3 (Hono + Drizzle ORM + Zod)
=================================================================
Runtime:    Node.js via @hono/node-server
Framework:  Hono (ultra-ligero, tipo-seguro)
ORM:        Drizzle ORM (SQL con tipos TypeScript)
Validación: Zod + @hono/zod-validator
Imágenes:   Cloudinary con fallback local
=================================================================
*/

import 'dotenv/config';
import webpush from 'web-push';
import Stripe from 'stripe';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { eq, and, or, gte, lte, asc, desc, sql, count, avg, isNull, inArray } from 'drizzle-orm';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import { v2 as cloudinary } from 'cloudinary';
import { Pool as PgPool } from 'pg';

import { db, pool } from './db/index';
import {
  productos, pedidos, pedidoItems, usuarios, comentarios,
  categorias, valoraciones, favoritos, cupones, productoImagenes,
  pushSubscriptions, securityEvents, blockedIps, passwordResetTokens, auditLog,
} from './db/schema';
import {
  ProductoBodySchema, ProductosQuerySchema, LoginSchema, RegisterSchema,
  PedidoSchema, PedidoEstadoSchema, ComentarioSchema, ValoracionSchema,
  CategoriaSchema, CuponSchema, ValidarCuponSchema, PushSubscriptionSchema,
  PerfilSchema, CambiarPasswordSchema,
} from './schemas';
import {
  generateTwoFactorSecret,
  generateTwoFactorQR,
  verifyTwoFactorCode,
  disableTwoFactor,
} from './2fa';
import { anomalyDetector } from './ip-anomaly';

const PORT = 3001;
const IVA_RATE = 0.21;
const CLIENT_DB_HOST = process.env.CLIENT_DB_HOST || process.env.DB_HOST || 'localhost';
const CLIENT_DB_PORT = Number.parseInt(process.env.CLIENT_DB_PORT || process.env.DB_PORT || '5432');
const CLIENT_DB_NAME = process.env.CLIENT_DB_NAME || 'kratamex_clientes';
const CLIENT_DB_USER = process.env.CLIENT_DB_USER || process.env.DB_USER || 'kratamex';
const CLIENT_DB_PASSWORD = process.env.CLIENT_DB_PASSWORD || process.env.DB_PASSWORD;
const SOC_DB_HOST = process.env.SOC_DB_HOST || process.env.DB_HOST || 'localhost';
const SOC_DB_PORT = Number.parseInt(process.env.SOC_DB_PORT || process.env.DB_PORT || '5432');
const SOC_DB_NAME = process.env.SOC_DB_NAME || 'kratamex_soc';
const SOC_DB_USER = process.env.SOC_DB_USER || process.env.DB_USER || 'kratamex';
const SOC_DB_PASSWORD = process.env.SOC_DB_PASSWORD || process.env.DB_PASSWORD;

const socPool = new PgPool({
  host: SOC_DB_HOST,
  port: SOC_DB_PORT,
  database: SOC_DB_NAME,
  user: SOC_DB_USER,
  password: SOC_DB_PASSWORD,
});
const clientPool = new PgPool({
  host: CLIENT_DB_HOST,
  port: CLIENT_DB_PORT,
  database: CLIENT_DB_NAME,
  user: CLIENT_DB_USER,
  password: CLIENT_DB_PASSWORD,
});

// =================================================================
// WEB PUSH (VAPID) — genera claves con: npx web-push generate-vapid-keys
// .env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, EMAIL_FROM
// =================================================================
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.EMAIL_FROM || 'admin@kratamex.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function sendPushToUser(usuarioId: number | null, payload: { title: string; body: string; tag?: string }) {
  if (!process.env.VAPID_PUBLIC_KEY) return;
  const query = usuarioId
    ? db.select().from(pushSubscriptions).where(eq(pushSubscriptions.usuarioId, usuarioId))
    : Promise.resolve([] as (typeof pushSubscriptions.$inferSelect)[]);
  const subs = await query;
  const body = JSON.stringify({ ...payload, icon: '/icon-192.png' });
  const dead: number[] = [];
  await Promise.allSettled(subs.map(async (sub, i) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(sub.id);
    }
  }));
  if (dead.length) {
    await db.delete(pushSubscriptions).where(
      sql`id = ANY(ARRAY[${sql.join(dead.map(id => sql`${id}`), sql`, `)}])`,
    );
  }
}
const ENVIO_GRATIS_MINIMO = 100;
const ENVIO_ESTANDAR = 5.99;

// =================================================================
// STRIPE
// =================================================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-02-25.clover',
});

// =================================================================
// CLOUDINARY
// =================================================================
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

async function uploadToCloudinary(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, resource_type: 'image', transformation: [{ width: 800, height: 800, crop: 'limit' }] },
        (err, result) => (err ? reject(err) : result ? resolve(result.secure_url) : reject(new Error('Cloudinary upload failed')))
      )
      .end(buffer);
  });
}

// =================================================================
// EMAIL (nodemailer — Gmail SMTP)
// =================================================================
const mailer = nodemailer.createTransport({ // NOSONAR - gmail service usa SMTPS (puerto 465) con TLS por defecto
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendResetEmail(to: string, token: string, username: string) {
  const link = `${process.env.CORS_ORIGIN || 'https://localhost'}/reset-password?token=${token}`;
  const nombre = username.charAt(0).toUpperCase() + username.slice(1);
  const ahora  = new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid' });
  await mailer.sendMail({
    from: `"Kratamex" <${process.env.EMAIL_FROM}>`,
    to,
    subject: `${nombre}, aquí está tu enlace para restablecer la contraseña`,
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#1e293b;border-radius:20px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.6);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8 0%,#6d28d9 100%);padding:44px 44px 36px;text-align:center;">
            <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:10px 26px;margin-bottom:24px;">
              <span style="color:#fff;font-size:20px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">Kratamex</span>
            </div>
            <div style="background:rgba(255,255,255,0.1);border-radius:50%;width:72px;height:72px;margin:0 auto 18px;text-align:center;line-height:72px;font-size:34px;">🔐</div>
            <h1 style="margin:0 0 6px;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Restablece tu contraseña</h1>
            <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;">Te ayudamos a recuperar el acceso a tu cuenta</p>
          </td>
        </tr>

        <!-- SALUDO -->
        <tr>
          <td style="padding:36px 44px 0;">
            <p style="margin:0;color:#e2e8f0;font-size:17px;font-weight:600;">Hola, ${nombre} 👋</p>
          </td>
        </tr>

        <!-- CUERPO -->
        <tr>
          <td style="padding:16px 44px 32px;">
            <p style="margin:0 0 10px;color:#94a3b8;font-size:15px;line-height:1.8;">
              Recibimos una solicitud para restablecer la contraseña asociada a tu cuenta de
              <strong style="color:#c7d2fe;">Kratamex</strong>.
              Si fuiste tú, haz clic en el botón de abajo — solo te llevará un momento.
            </p>
            <p style="margin:0 0 28px;color:#64748b;font-size:13px;">
              Solicitud realizada el <strong style="color:#94a3b8;">${ahora}</strong>
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:0 0 32px;">
                  <a href="${link}"
                     style="display:inline-block;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;text-decoration:none;font-size:17px;font-weight:700;padding:18px 48px;border-radius:14px;letter-spacing:0.2px;box-shadow:0 8px 32px rgba(37,99,235,0.5);">
                    Crear nueva contraseña &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info técnica -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#0f172a;border-radius:12px;padding:20px 22px;border-left:3px solid #2563eb;">
                  <p style="margin:0 0 12px;color:#6366f1;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;">Detalles de seguridad</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:3px 0;">⏱</td>
                      <td style="color:#94a3b8;font-size:13px;padding:3px 0 3px 8px;">Este enlace <strong style="color:#e2e8f0;">caduca en 1 hora</strong></td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:3px 0;">🔒</td>
                      <td style="color:#94a3b8;font-size:13px;padding:3px 0 3px 8px;">Solo puede usarse <strong style="color:#e2e8f0;">una única vez</strong></td>
                    </tr>
                    <tr>
                      <td style="color:#64748b;font-size:13px;padding:3px 0;">👤</td>
                      <td style="color:#94a3b8;font-size:13px;padding:3px 0 3px 8px;">Vinculado exclusivamente a la cuenta <strong style="color:#e2e8f0;">${nombre}</strong></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- Aviso si no lo pidieron -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a0a0a;border:1px solid #7f1d1d;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0 0 4px;color:#fca5a5;font-size:12px;font-weight:700;">⚠️ &nbsp;¿No solicitaste este cambio?</p>
                  <p style="margin:0;color:#f87171;font-size:13px;line-height:1.6;">
                    Ignora este email — tu contraseña actual <strong>no cambiará</strong>. Si crees que alguien intentó acceder a tu cuenta, te recomendamos revisar la seguridad de tu email.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;color:#374151;font-size:12px;line-height:1.7;">
              ¿El botón no abre? Copia y pega este enlace en tu navegador:<br>
              <a href="${link}" style="color:#6366f1;word-break:break-all;font-size:11px;">${link}</a>
            </p>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td style="padding:0 44px;"><hr style="border:none;border-top:1px solid #1e3a5f;margin:0;"></td></tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:24px 44px;text-align:center;">
            <p style="margin:0 0 6px;color:#334155;font-size:13px;">
              &copy; 2025 <strong style="color:#475569;">Kratamex</strong> &middot; Tienda online de tecnología
            </p>
            <p style="margin:0;color:#1e3a5f;font-size:11px;">
              Este mensaje fue generado automáticamente. Por favor, no respondas a este correo.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

// =================================================================
// SEGURIDAD
// =================================================================
function sanitizeText(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

const ALLOWED_EXT  = /^\.(jpe?g|png|gif|webp)$/i;
const ALLOWED_MIME = /^image\/(jpe?g|png|gif|webp)$/i;

// =================================================================
// LOGGER
// =================================================================
const LOG_FILE = path.join(__dirname, 'access.log');
function appendLog(msg: string) {
  fs.appendFile(LOG_FILE, msg, (err) => { if (err) console.error('Log error:', err); });
}

// =================================================================
// SESIONES
// =================================================================
type SessionData = {
  id: number;
  username: string;
  role: string;
  avatar: string | null;
  createdAt: number;
  twoFactorVerified?: boolean;
};

type SocSessionData = {
  id: number;
  username: string;
  createdAt: number;
};

const sessions: Record<string, SessionData> = {};
const socSessions: Record<string, SocSessionData> = {};
const SESSION_TTL = 8 * 60 * 60 * 1000;
const SOC_SESSION_TTL = 8 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of Object.entries(sessions)) {
    if (now - session.createdAt > SESSION_TTL) delete sessions[token];
  }
  for (const [token, session] of Object.entries(socSessions)) {
    if (now - session.createdAt > SOC_SESSION_TTL) delete socSessions[token];
  }
}, 15 * 60 * 1000);

// =================================================================
// BLOCKED IPs (in-memory cache synced from DB every 60s)
// =================================================================
let blockedIpSet    = new Set<string>();
let blockedIpCacheTs = 0;
const BLOCKED_CACHE_TTL = 60_000;

async function refreshBlockedCache() {
  try {
    const now = new Date();
    const rows = await db.select({ ip: blockedIps.ip }).from(blockedIps)
      .where(sql`${blockedIps.bloqueadoHasta} IS NULL OR ${blockedIps.bloqueadoHasta} > ${now}`);
    blockedIpSet = new Set(rows.map(r => r.ip));
    blockedIpCacheTs = Date.now();
  } catch (err) { console.error('[blockedIpCache]', err); }
}

async function autoBlockIp(ip: string, motivo: string) {
  if (!ip || ip === 'unknown') return;
  try {
    const hasta = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO blocked_ips (ip, motivo, bloqueado_hasta)
       VALUES ($1, $2, $3)
       ON CONFLICT (ip) DO UPDATE SET motivo = $2, bloqueado_hasta = $3, created_at = NOW()`,
      [ip, motivo, hasta.toISOString()]
    );
    blockedIpSet.add(ip);
  } catch (err) { console.error('[autoBlockIp]', err); }
}

// =================================================================
// RATE LIMITING
// =================================================================
type RateLimitRecord = { count: number; windowStart: number };
type LoginRecord     = { count: number; blockedUntil: number | null; lastAttempt?: number };

const generalAttempts:     Record<string, RateLimitRecord> = {};
const loginAttempts:       Record<string, LoginRecord>     = {};
const checkoutAttempts:    Record<string, RateLimitRecord> = {};
const comentariosAttempts: Record<string, RateLimitRecord> = {};

const GENERAL_MAX    = 60;
const GENERAL_WINDOW = 60_000;
const MAX_CHECKOUT   = 10;
const CHECKOUT_WINDOW = 60_000;
const MAX_ATTEMPTS   = 12;
const BLOCK_DURATION = 60_000;

function cleanupWindowAttempts(map: Record<string, RateLimitRecord>, windowMs: number, now: number) {
  for (const ip of Object.keys(map)) {
    if (now - map[ip].windowStart > windowMs * 5) delete map[ip];
  }
}

function isLoginExpired(rec: LoginRecord, now: number): boolean {
  if (rec.blockedUntil) return now > rec.blockedUntil + 300_000;
  return now - (rec.lastAttempt || 0) > 300_000;
}

setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(loginAttempts)) {
    if (isLoginExpired(loginAttempts[ip], now)) delete loginAttempts[ip];
  }
  cleanupWindowAttempts(checkoutAttempts,    CHECKOUT_WINDOW, now);
  cleanupWindowAttempts(generalAttempts,     GENERAL_WINDOW,  now);
  cleanupWindowAttempts(comentariosAttempts, 60_000,          now);
}, 5 * 60 * 1000);

// =================================================================
// HONO APP
// =================================================================
type Variables = { user: SessionData; socUser: SocSessionData };
const app = new Hono<{ Variables: Variables }>();

// IPs de proxies de confianza (nginx en Docker usa la red interna 172.x.x.x)
const TRUSTED_PROXY_CIDRS = (process.env.TRUSTED_PROXIES || '172.16.0.0/12,10.0.0.0/8,127.0.0.1').split(',').map(s => s.trim());

function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/');
    const mask = bits ? ~((1 << (32 - Number(bits))) - 1) : -1;
    const ipNum  = ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0);
    const rangeNum = range.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0);
    return (ipNum & mask) === (rangeNum & mask);
  } catch { return false; }
}

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXY_CIDRS.some(cidr => ipInCidr(ip, cidr));
}

function getClientIP(c: Context): string {
  const remoteIp = c.req.header('x-real-ip');
  // Si tenemos IP real y viene de un proxy de confianza, usar X-Forwarded-For
  if (remoteIp && isTrustedProxy(remoteIp)) {
    const forwarded = c.req.header('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
  }
  // Si tenemos IP real pero no es proxy de confianza, usarla directamente (ignora XFF spoofed)
  if (remoteIp) return remoteIp;
  // Sin IP real (entorno dev/test): usar X-Forwarded-For si existe, si no 'unknown'
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

// --- Security headers ---
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '0');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
  c.res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  c.res.headers.delete('X-Powered-By');
});

// --- CORS ---
const ALLOWED_ORIGINS = new Set([
  process.env.CORS_ORIGIN     || 'https://localhost',
  process.env.DEV_CORS_ORIGIN || 'http://localhost:3000',
]);
app.use('*', cors({
  origin: (origin) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return origin || '*';
    return null;
  },
  credentials: true,
}));

// --- Logger ---
app.use('*', async (c, next) => {
  const entry = `[${new Date().toISOString()}] ${getClientIP(c)} - ${c.req.method} ${c.req.url}\n`;
  appendLog(entry);
  await next();
});

// --- IP Block middleware ---
app.use('*', async (c, next) => {
  if (Date.now() - blockedIpCacheTs > BLOCKED_CACHE_TTL) await refreshBlockedCache();
  const ip = getClientIP(c);
  if (blockedIpSet.has(ip)) {
    logSecEvent('blocked_request', { ip, endpoint: c.req.path, metodo: c.req.method, userAgent: c.req.header('user-agent'), detalles: 'IP bloqueada' });
    return c.json({ error: 'Acceso denegado' }, 403);
  }
  await next();
});

// --- Static files ---
app.use('/uploads/*', serveStatic({ root: './src' }));
app.use('/avatars/*', serveStatic({ root: './src' }));

// =================================================================
// MIDDLEWARE — Rate limiters
// =================================================================
const generalRateLimiter: MiddlewareHandler = async (c, next) => {
  const ip = getClientIP(c);
  const now = Date.now();
  if (!generalAttempts[ip] || now - generalAttempts[ip].windowStart > GENERAL_WINDOW) {
    generalAttempts[ip] = { count: 1, windowStart: now };
    return next();
  }
  if (++generalAttempts[ip].count > GENERAL_MAX)
    return c.json({ error: 'Demasiadas solicitudes. Intenta más tarde.' }, 429);
  return next();
};

const loginRateLimiter: MiddlewareHandler = async (c, next) => {
  const ip = getClientIP(c);
  const now = Date.now();
  const rec = loginAttempts[ip];
  if (rec?.blockedUntil && now < rec.blockedUntil) {
    const seg = Math.ceil((rec.blockedUntil - now) / 1000);
    appendLog(`[${new Date().toISOString()}] RATE_LIMIT ip=${ip}\n`);
    return c.json({ error: `Demasiados intentos. Intenta en ${seg} segundos.` }, 429);
  }
  return next();
};

const checkoutRateLimiter: MiddlewareHandler = async (c, next) => {
  const ip = getClientIP(c);
  const now = Date.now();
  if (!checkoutAttempts[ip] || now - checkoutAttempts[ip].windowStart > CHECKOUT_WINDOW) {
    checkoutAttempts[ip] = { count: 1, windowStart: now };
    return next();
  }
  if (++checkoutAttempts[ip].count > MAX_CHECKOUT) {
    appendLog(`[${new Date().toISOString()}] CHECKOUT_FLOOD ip=${ip}\n`);
    return c.json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }, 429);
  }
  return next();
};

const comentariosRateLimiter: MiddlewareHandler = async (c, next) => {
  const ip = getClientIP(c);
  const now = Date.now();
  if (!comentariosAttempts[ip] || now - comentariosAttempts[ip].windowStart > 60_000) {
    comentariosAttempts[ip] = { count: 1, windowStart: now };
    return next();
  }
  if (++comentariosAttempts[ip].count > 10)
    return c.json({ error: 'Demasiados comentarios. Espera un momento.' }, 429);
  return next();
};

// =================================================================
// MIDDLEWARE — Autenticación
// =================================================================
const authenticate: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const token = c.req.header('authorization');
  if (!token || !sessions[token]) {
    if (token) logSecEvent('auth_invalid', { ip: getClientIP(c), endpoint: c.req.path, metodo: c.req.method, userAgent: c.req.header('user-agent'), detalles: 'Token no encontrado en sesiones' });
    return c.json({ error: 'No autenticado' }, 401);
  }
  const session = sessions[token];
  if (Date.now() - session.createdAt > SESSION_TTL) {
    delete sessions[token];
    logSecEvent('auth_invalid', { ip: getClientIP(c), username: session.username, endpoint: c.req.path, metodo: c.req.method, userAgent: c.req.header('user-agent'), detalles: 'Sesión expirada' });
    return c.json({ error: 'Sesión expirada' }, 401);
  }

  const [user] = await db.select({
    twoFactorEnabled: usuarios.twoFactorEnabled,
  }).from(usuarios).where(eq(usuarios.id, session.id));

  if (user?.twoFactorEnabled && !session.twoFactorVerified) {
    if (!c.req.path.startsWith('/api/2fa/') && c.req.path !== '/api/usuario') {
      return c.json({ error: '2FA requerido', requiresTwoFactor: true }, 403);
    }
  }

  // Auto-verify if 2FA is not enabled
  if (!user?.twoFactorEnabled) {
    session.twoFactorVerified = true;
  }

  c.set('user', session);
  await next();
};

const requireTwoFactorVerified: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const user = c.get('user');
  if (!user?.twoFactorVerified) {
    return c.json({ error: 'Verificación 2FA requerida', requiresTwoFactor: true }, 403);
  }
  await next();
};

const requireAdmin: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  if (c.get('user')?.role !== 'admin')
    return c.json({ error: 'Acceso denegado. Se requiere rol de administrador' }, 403);
  await next();
};

const authenticateSoc: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const token = c.req.header('authorization');
  if (!token || !socSessions[token]) {
    return c.json({ error: 'No autenticado en SOC' }, 401);
  }
  const session = socSessions[token];
  if (Date.now() - session.createdAt > SOC_SESSION_TTL) {
    delete socSessions[token];
    return c.json({ error: 'Sesion SOC expirada' }, 401);
  }
  c.set('socUser', session);
  await next();
};

const optionalAuth: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const token = c.req.header('authorization');
  if (token && sessions[token]) {
    const session = sessions[token];
    if (Date.now() - session.createdAt <= SESSION_TTL) {
      c.set('user', session);
    }
  }
  await next();
};

// =================================================================
// HELPERS — Upload
// =================================================================
async function handleFileUpload(file: File, folder: string, maxSize = 5 * 1024 * 1024): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXT.test(ext) || !ALLOWED_MIME.test(file.type))
    throw Object.assign(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'), { status: 400 });
  if (file.size > maxSize)
    throw Object.assign(new Error(`La imagen no puede superar ${Math.round(maxSize / 1024 / 1024)}MB`), { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (process.env.CLOUDINARY_CLOUD_NAME) {
    return uploadToCloudinary(buffer, `kratamex/${folder}`);
  }
  const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/${folder}/${filename}`;
}

// =================================================================
// HELPERS — Envío e impuestos
// =================================================================
function calcularEnvio(subtotal: number): number {
  return subtotal >= ENVIO_GRATIS_MINIMO ? 0 : ENVIO_ESTANDAR;
}

function calcularImpuestos(subtotal: number): number {
  return Math.round(subtotal * IVA_RATE * 100) / 100;
}

// =================================================================
// HELPERS — Coupon application (shared by /api/pedidos and /api/pedidos/checkout)
// =================================================================
type TxLike = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function applyCupon(
  tx: TxLike,
  codigoCupon: string | undefined,
  subtotal: number
): Promise<{ descuento: number; cuponId: number | null }> {
  if (!codigoCupon) return { descuento: 0, cuponId: null };

  const [cup] = await tx.select().from(cupones).where(eq(cupones.codigo, codigoCupon.toUpperCase()));
  if (!cup?.activo) return { descuento: 0, cuponId: null };

  const now = new Date();
  const validDate = (!cup.fechaInicio || new Date(cup.fechaInicio) <= now) &&
                    (!cup.fechaFin    || new Date(cup.fechaFin)    >= now);
  const validUsos = !cup.maxUsos || (cup.usosActuales ?? 0) < cup.maxUsos;
  const validMin  = subtotal >= (cup.minCompra ?? 0);

  if (!validDate || !validUsos || !validMin) return { descuento: 0, cuponId: null };

  const descuento = cup.tipo === 'porcentaje'
    ? Math.round(subtotal * (cup.valor / 100) * 100) / 100
    : Math.min(cup.valor, subtotal);

  await tx.update(cupones).set({ usosActuales: (cup.usosActuales ?? 0) + 1 }).where(eq(cupones.id, cup.id));
  return { descuento, cuponId: cup.id };
}

// =================================================================
// SECURITY EVENT LOGGER
// =================================================================
async function logSecEvent(tipo: string, data: {
  ip?: string; username?: string; endpoint?: string;
  metodo?: string; userAgent?: string; detalles?: string;
}) {
  try {
    await db.insert(securityEvents).values({ tipo, ...data });
  } catch (err) { console.error('[logSecEvent]', err); }
}

// =================================================================
// AUDIT LOGGER
// =================================================================
async function logAudit(adminId: number, adminUsername: string, accion: string, entidad: string, entidadId?: number, detalles?: string) {
  try {
    await db.insert(auditLog).values({ adminId, adminUsername, accion, entidad, entidadId, detalles });
  } catch (err) { console.error('[logAudit]', err); }
}

type ClientUserRow = {
  id: number;
  username: string;
  password: string;
  email: string | null;
  nombre: string | null;
  direccion: string | null;
  telefono: string | null;
  idioma: string | null;
  avatar: string | null;
  puntos: number | null;
};

async function getClientUserByUsername(username: string): Promise<ClientUserRow | null> {
  const result = await clientPool.query(
    `SELECT id, username, password, email, nombre, direccion, telefono, idioma, avatar, puntos
     FROM client_users WHERE username = $1`,
    [username],
  );
  return result.rows[0] ?? null;
}

async function getClientUserByEmail(email: string): Promise<ClientUserRow | null> {
  const result = await clientPool.query(
    `SELECT id, username, password, email, nombre, direccion, telefono, idioma, avatar, puntos
     FROM client_users WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function ensureClientShadowUser(data: {
  username: string;
  password: string;
  email?: string | null;
  nombre?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  idioma?: string | null;
  avatar?: string | null;
  puntos?: number | null;
}) {
  const [existing] = await db.select().from(usuarios).where(eq(usuarios.username, data.username));
  const payload = {
    username: data.username,
    password: data.password,
    email: data.email ?? null,
    nombre: data.nombre ?? null,
    direccion: data.direccion ?? null,
    telefono: data.telefono ?? null,
    idioma: data.idioma ?? 'es',
    avatar: data.avatar ?? null,
    puntos: data.puntos ?? 0,
    role: 'standard' as const,
  };
  if (existing) {
    await db.update(usuarios).set(payload).where(eq(usuarios.id, existing.id));
    return existing;
  }
  const [created] = await db.insert(usuarios).values(payload).returning({
    id: usuarios.id,
    username: usuarios.username,
    role: usuarios.role,
    avatar: usuarios.avatar,
    nombre: usuarios.nombre,
    email: usuarios.email,
    puntos: usuarios.puntos,
  });
  return created;
}

// =================================================================
// RUTAS — HEALTH CHECK
// =================================================================
app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// =================================================================
// RUTAS — PRODUCTOS
// =================================================================
app.get('/api/productos', generalRateLimiter, zValidator('query', ProductosQuerySchema), async (c) => {
  try {
    const { busqueda, categoria, orden, desde, hasta, enStock, destacado, limit: qLimit, offset: qOffset } = c.req.valid('query');

    const conditions: ReturnType<typeof sql>[] = [];
    if (busqueda) {
      const term = `%${busqueda}%`;
      conditions.push(
        sql`(${productos.nombre} ILIKE ${term} OR ${productos.descripcion} ILIKE ${term} OR ${productos.categoria} ILIKE ${term} OR ${productos.sku} ILIKE ${term})`
      );
    }
    if (categoria) conditions.push(eq(productos.categoria, categoria) as unknown as ReturnType<typeof sql>);
    if (desde !== undefined) conditions.push(gte(productos.precio, desde) as unknown as ReturnType<typeof sql>);
    if (hasta !== undefined) conditions.push(lte(productos.precio, hasta) as unknown as ReturnType<typeof sql>);
    if (enStock) conditions.push(sql`${productos.stock} > 0`);
    if (destacado) conditions.push(eq(productos.destacado, true) as unknown as ReturnType<typeof sql>);
    // Ocultar productos marcados como inactivos o eliminados (soft delete)
    conditions.push(sql`${productos.activo} = true`);
    conditions.push(isNull(productos.deletedAt) as unknown as ReturnType<typeof sql>);

    let orderBy;
    if (orden === 'asc')        orderBy = asc(productos.precio);
    else if (orden === 'desc')  orderBy = desc(productos.precio);
    else if (orden === 'nuevo') orderBy = desc(productos.fecha);
    else                        orderBy = asc(productos.id);

    const rows = await db.select().from(productos)
      .where(conditions.length ? and(...conditions as Parameters<typeof and>) : undefined)
      .orderBy(orderBy)
      .limit(qLimit || 100)
      .offset(qOffset || 0);

    // Attach average ratings
    const productIds = rows.map(r => r.id);
    let ratingsMap: Record<number, { avg: number; count: number }> = {};
    if (productIds.length > 0) {
      const idsSql = sql.join(productIds.map((id) => sql`${id}`), sql`,`);
      const ratingsResult = await db.select({
        productoId: valoraciones.productoId,
        avg: avg(valoraciones.puntuacion),
        count: count(),
      }).from(valoraciones)
        .where(sql`${valoraciones.productoId} IN (${idsSql})`)
        .groupBy(valoraciones.productoId);
      for (const r of ratingsResult) {
        ratingsMap[r.productoId] = { avg: Number.parseFloat(r.avg as string) || 0, count: Number(r.count) };
      }
    }

    const result = rows.map(p => ({
      ...p,
      rating: ratingsMap[p.id]?.avg || 0,
      numValoraciones: ratingsMap[p.id]?.count || 0,
    }));

    return c.json(result);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.get('/api/productos/:id', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [producto] = await db.select().from(productos).where(and(eq(productos.id, id), isNull(productos.deletedAt)));
    if (!producto) return c.json({ error: 'Producto no encontrado' }, 404);

    // Get images
    const imagenes = await db.select().from(productoImagenes)
      .where(eq(productoImagenes.productoId, id))
      .orderBy(asc(productoImagenes.orden));

    // Get rating
    const [ratingData] = await db.select({
      avg: avg(valoraciones.puntuacion),
      count: count(),
    }).from(valoraciones).where(eq(valoraciones.productoId, id));

    return c.json({
      ...producto,
      imagenes: imagenes.map(i => i.url),
      rating: Number.parseFloat(ratingData?.avg as string) || 0,
      numValoraciones: Number(ratingData?.count) || 0,
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/productos', authenticate, requireAdmin, zValidator('json', ProductoBodySchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const [row] = await db.insert(productos).values({
      nombre:      sanitizeText(data.nombre),
      descripcion: sanitizeText(data.descripcion || ''),
      precio:      data.precio,
      imagen:      data.imagen || '',
      categoria:   sanitizeText(data.categoria || ''),
      stock:       data.stock ?? 0,
      sku:         data.sku || '',
      destacado:   data.destacado ?? false,
      activo:      data.activo ?? true,
    }).returning({ id: productos.id });
    const u = c.get('user'); await logAudit(u.id, u.username, 'crear', 'producto', row.id, `Nombre: ${sanitizeText(data.nombre)}`);
    return c.json({ id: row.id, mensaje: 'Producto creado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.put('/api/productos/:id', authenticate, requireAdmin, zValidator('json', ProductoBodySchema), async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const data = c.req.valid('json');
    const result = await db.update(productos).set({
      nombre:      sanitizeText(data.nombre),
      descripcion: sanitizeText(data.descripcion || ''),
      precio:      data.precio,
      imagen:      data.imagen || '',
      categoria:   sanitizeText(data.categoria || ''),
      stock:       data.stock ?? 0,
      sku:         data.sku || '',
      destacado:   data.destacado ?? false,
      activo:      data.activo ?? true,
    }).where(eq(productos.id, id)).returning({ id: productos.id });

    if (!result.length) return c.json({ error: 'Producto no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'actualizar', 'producto', id, `Nombre: ${sanitizeText(data.nombre)}`);
    return c.json({ mensaje: 'Producto actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/productos/:id/imagen', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [prod] = await db.select({ id: productos.id }).from(productos).where(eq(productos.id, id));
    if (!prod) return c.json({ error: 'Producto no encontrado' }, 404);

    const body = await c.req.parseBody();
    const file = body['imagen'];
    if (!file || typeof file === 'string')
      return c.json({ error: 'No se proporcionó imagen' }, 400);

    const imagenUrl = await handleFileUpload(file as File, 'uploads');
    await db.update(productos).set({ imagen: imagenUrl }).where(eq(productos.id, id));
    return c.json({ success: true, imagen: imagenUrl });
  } catch (err: any) {
    if (err.status === 400) return c.json({ error: err.message }, 400);
    console.error(err);
    return c.json({ error: 'Error al subir la imagen' }, 500);
  }
});

// Galería: múltiples imágenes
app.post('/api/productos/:id/galeria', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [prod] = await db.select({ id: productos.id }).from(productos).where(eq(productos.id, id));
    if (!prod) return c.json({ error: 'Producto no encontrado' }, 404);

    const body = await c.req.parseBody({ all: true });
    const files = Array.isArray(body['imagenes']) ? body['imagenes'] : [body['imagenes']];
    const urls: string[] = [];

    for (const file of files) {
      if (!file || typeof file === 'string') continue;
      const url = await handleFileUpload(file as File, 'uploads');
      const currentMax = await db.select({ maxOrden: sql<number>`COALESCE(MAX(${productoImagenes.orden}), -1)` })
        .from(productoImagenes).where(eq(productoImagenes.productoId, id));
      await db.insert(productoImagenes).values({
        productoId: id,
        url,
        orden: (currentMax[0]?.maxOrden ?? -1) + 1,
      });
      urls.push(url);
    }

    return c.json({ success: true, imagenes: urls });
  } catch (err: any) {
    if (err.status === 400) return c.json({ error: err.message }, 400);
    console.error(err);
    return c.json({ error: 'Error al subir imágenes' }, 500);
  }
});

app.delete('/api/productos/:id/galeria/:imgId', authenticate, requireAdmin, async (c) => {
  try {
    const imgId = Number.parseInt(c.req.param('imgId'));
    if (Number.isNaN(imgId)) return c.json({ error: 'ID inválido' }, 400);
    await db.delete(productoImagenes).where(eq(productoImagenes.id, imgId));
    return c.json({ mensaje: 'Imagen eliminada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

const StockPatchSchema = z.object({
  stock:  z.number().int().min(0).max(999999).optional(),
  activo: z.boolean().optional(),
});

app.patch('/api/productos/:id/stock', authenticate, requireAdmin, zValidator('json', StockPatchSchema), async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const body = c.req.valid('json');
    const updateData: Record<string, unknown> = {};
    if (body.stock !== undefined) updateData.stock = body.stock;
    if (body.activo !== undefined) updateData.activo = body.activo;
    if (Object.keys(updateData).length === 0) return c.json({ error: 'Sin campos para actualizar' }, 400);
    const result = await db.update(productos).set(updateData).where(eq(productos.id, id)).returning({ id: productos.id });
    if (!result.length) return c.json({ error: 'Producto no encontrado' }, 404);
    return c.json({ mensaje: 'Stock actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/productos/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.update(productos).set({ deletedAt: new Date() }).where(and(eq(productos.id, id), isNull(productos.deletedAt))).returning({ id: productos.id });
    if (!result.length) return c.json({ error: 'Producto no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'eliminar', 'producto', id);
    return c.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — VALORACIONES
// =================================================================
app.get('/api/productos/:id/valoraciones', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const rows = await db.select({
      id:         valoraciones.id,
      puntuacion: valoraciones.puntuacion,
      titulo:     valoraciones.titulo,
      comentario: valoraciones.comentario,
      fecha:      valoraciones.fecha,
      username:   usuarios.username,
      avatar:     usuarios.avatar,
    }).from(valoraciones)
      .innerJoin(usuarios, eq(valoraciones.usuarioId, usuarios.id))
      .where(eq(valoraciones.productoId, id))
      .orderBy(desc(valoraciones.fecha))
      .limit(50);

    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/productos/:id/valoraciones', authenticate, zValidator('json', ValoracionSchema), async (c) => {
  try {
    const productoId = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(productoId)) return c.json({ error: 'ID inválido' }, 400);

    const user = c.get('user');
    const data = c.req.valid('json');

    // Check if already rated
    const [existing] = await db.select({ id: valoraciones.id }).from(valoraciones)
      .where(and(eq(valoraciones.productoId, productoId), eq(valoraciones.usuarioId, user.id)));
    if (existing) {
      await db.update(valoraciones).set({
        puntuacion: data.puntuacion,
        titulo:     sanitizeText(data.titulo || ''),
        comentario: sanitizeText(data.comentario || ''),
      }).where(eq(valoraciones.id, existing.id));
      return c.json({ mensaje: 'Valoración actualizada' });
    }

    await db.insert(valoraciones).values({
      productoId,
      usuarioId:  user.id,
      puntuacion: data.puntuacion,
      titulo:     sanitizeText(data.titulo || ''),
      comentario: sanitizeText(data.comentario || ''),
    });
    return c.json({ mensaje: 'Valoración creada' }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — COMENTARIOS
// =================================================================
app.get('/api/productos/:id/comentarios', async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const rows = await db.select({
      id:        comentarios.id,
      autor:     comentarios.autor,
      contenido: comentarios.contenido,
      fecha:     comentarios.fecha,
    }).from(comentarios)
      .where(eq(comentarios.productoId, id))
      .orderBy(desc(comentarios.fecha))
      .limit(50);

    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/productos/:id/comentarios', comentariosRateLimiter, zValidator('json', ComentarioSchema), async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const { autor, contenido } = c.req.valid('json');
    const [prod] = await db.select({ id: productos.id }).from(productos).where(eq(productos.id, id));
    if (!prod) return c.json({ error: 'Producto no encontrado' }, 404);

    const [row] = await db.insert(comentarios).values({
      productoId: id,
      autor:      sanitizeText(autor),
      contenido:  sanitizeText(contenido),
    }).returning({ id: comentarios.id, autor: comentarios.autor, contenido: comentarios.contenido, fecha: comentarios.fecha });

    return c.json(row, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// HELPER — CREACIÓN DE PEDIDO (compartido por checkout directo y Stripe)
// =================================================================
async function crearPedido(data: {
  cliente: string; email: string; direccion: string;
  items: { id: number; cantidad: number }[];
  cupon?: string; userId?: number | null; puntosCanjeados?: number;
}): Promise<{ id: number; total: number; subtotal: number; impuestos: number; envio: number; descuento: number; puntosGanados: number }> {
  const result = await db.transaction(async (tx) => {
    let subtotal = 0;
    const itemsValidados: { id: number; precio: number; cantidad: number }[] = [];

    for (const item of data.items) {
      const [prod] = await tx.select({ id: productos.id, precio: productos.precio, stock: productos.stock, nombre: productos.nombre })
        .from(productos)
        .where(eq(productos.id, item.id));
      if (!prod) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { status: 400 });
      if (prod.stock < item.cantidad) throw Object.assign(new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}`), { status: 400, code: 'INSUFFICIENT_STOCK' });

      subtotal += prod.precio * item.cantidad;
      itemsValidados.push({ id: prod.id, precio: prod.precio, cantidad: item.cantidad });
    }

    const { descuento, cuponId } = await applyCupon(tx, data.cupon, subtotal);

    // Canje de puntos de fidelidad (100 puntos = 5€)
    let descuentoPuntos = 0;
    const puntosCanjeados = data.puntosCanjeados ?? 0;
    if (puntosCanjeados > 0 && data.userId) {
      const [u] = await tx.select({ puntos: usuarios.puntos }).from(usuarios).where(eq(usuarios.id, data.userId));
      const puntosDisponibles = u?.puntos ?? 0;
      const puntosAUsar = Math.min(puntosCanjeados, puntosDisponibles);
      if (puntosAUsar > 0) {
        descuentoPuntos = Math.round((puntosAUsar / 100) * 5 * 100) / 100;
        await tx.update(usuarios).set({ puntos: sql`${usuarios.puntos} - ${puntosAUsar}` }).where(eq(usuarios.id, data.userId));
      }
    }

    const descuentoTotal = descuento + descuentoPuntos;
    const subtotalConDescuento = subtotal - descuentoTotal;
    const impuestos = calcularImpuestos(subtotalConDescuento);
    const envio = calcularEnvio(subtotalConDescuento);
    const total = Math.round((subtotalConDescuento + impuestos + envio) * 100) / 100;

    const [newPedido] = await tx.insert(pedidos).values({
      usuarioId:  data.userId ?? null,
      cliente:    sanitizeText(data.cliente),
      email:      data.email,
      direccion:  sanitizeText(data.direccion),
      subtotal:   subtotalConDescuento,
      impuestos,
      envio,
      descuento:  descuentoTotal,
      cuponId,
      total,
      estado:     'pendiente',
    }).returning({ id: pedidos.id });

    for (const item of itemsValidados) {
      await tx.insert(pedidoItems).values({
        pedidoId:   newPedido.id,
        productoId: item.id,
        cantidad:   item.cantidad,
        precio:     item.precio,
      });
      await tx.update(productos).set({
        stock: sql`${productos.stock} - ${item.cantidad}`,
      }).where(eq(productos.id, item.id));
    }

    return { id: newPedido.id, total, subtotal: subtotalConDescuento, impuestos, envio, descuento: descuentoTotal };
  });

  // Puntos ganados: 1 punto por cada 10€ del total final
  const puntosGanados = data.userId ? Math.floor(result.total / 10) : 0;
  if (puntosGanados > 0 && data.userId) {
    await db.update(usuarios).set({ puntos: sql`${usuarios.puntos} + ${puntosGanados}` }).where(eq(usuarios.id, data.userId));
  }

  return { ...result, puntosGanados };
}

// =================================================================
// RUTAS — PEDIDOS
// =================================================================
app.post('/api/pedidos', checkoutRateLimiter, optionalAuth, zValidator('json', PedidoSchema), async (c) => {
  const { cliente, email, direccion, items, cupon, puntosCanjeados } = c.req.valid('json');
  const user = c.get('user');
  try {
    const result = await crearPedido({ cliente, email, direccion, items, cupon, puntosCanjeados, userId: user?.id });
    return c.json({ ...result, mensaje: 'Pedido creado correctamente' });
  } catch (err: any) {
    if (err.message === 'PRODUCT_NOT_FOUND')
      return c.json({ error: 'Uno o más artículos no están disponibles' }, 400);
    if (err.code === 'INSUFFICIENT_STOCK')
      return c.json({ error: err.message }, 400);
    console.error(err);
    return c.json({ error: 'Error al procesar el pedido' }, 500);
  }
});

// Order history for authenticated user
app.get('/api/mis-pedidos', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const rows = await db.select().from(pedidos)
      .where(eq(pedidos.usuarioId, user.id))
      .orderBy(desc(pedidos.fecha));

    const pedidoIds = rows.map(p => p.id);

    // Single query for all items instead of N+1
    const allItems = pedidoIds.length > 0
      ? await db.select({
          pedidoId:   pedidoItems.pedidoId,
          id:         pedidoItems.id,
          productoId: pedidoItems.productoId,
          cantidad:   pedidoItems.cantidad,
          precio:     pedidoItems.precio,
          nombre:     productos.nombre,
          imagen:     productos.imagen,
        }).from(pedidoItems)
          .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
          .where(inArray(pedidoItems.pedidoId, pedidoIds))
      : [];

    const itemsByPedido = new Map<number, typeof allItems>();
    for (const item of allItems) {
      if (!itemsByPedido.has(item.pedidoId)) itemsByPedido.set(item.pedidoId, []);
      itemsByPedido.get(item.pedidoId)!.push(item);
    }

    const result = rows.map(p => ({ ...p, items: itemsByPedido.get(p.id) ?? [] }));
    return c.json(result);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Admin — list orders
app.get('/api/pedidos', authenticate, requireAdmin, async (c) => {
  try {
    const limit  = Math.min(Number.parseInt(c.req.query('limit') || '100'), 500);
    const offset = Math.max(Number.parseInt(c.req.query('offset') || '0'), 0);
    const rows = await db.select().from(pedidos)
      .orderBy(desc(pedidos.fecha))
      .limit(limit)
      .offset(offset);
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.get('/api/pedidos/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, id));
    if (!pedido) return c.json({ error: 'Pedido no encontrado' }, 404);

    const items = await db.select({
      id:         pedidoItems.id,
      pedidoId:   pedidoItems.pedidoId,
      productoId: pedidoItems.productoId,
      cantidad:   pedidoItems.cantidad,
      precio:     pedidoItems.precio,
      nombre:     productos.nombre,
      imagen:     productos.imagen,
    }).from(pedidoItems)
      .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
      .where(eq(pedidoItems.pedidoId, id));

    return c.json({ ...pedido, items });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Update order status
app.patch('/api/pedidos/:id/estado', authenticate, requireAdmin, zValidator('json', PedidoEstadoSchema), async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const { estado, notas } = c.req.valid('json');
    const updateData: Record<string, unknown> = { estado };
    if (notas !== undefined) updateData.notas = sanitizeText(notas);

    const result = await db.update(pedidos).set(updateData).where(eq(pedidos.id, id)).returning({ id: pedidos.id, usuarioId: pedidos.usuarioId });
    if (!result.length) return c.json({ error: 'Pedido no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'cambio_estado', 'pedido', id, `Estado: ${estado}`);

    // Notificación push en estados relevantes
    if (estado === 'enviado' || estado === 'entregado') {
      const msg = estado === 'enviado'
        ? { title: '📦 Pedido en camino', body: `Tu pedido #${id} ha sido enviado y está en camino.`, tag: `pedido-${id}` }
        : { title: '✅ Pedido entregado', body: `Tu pedido #${id} ha sido entregado. ¡Esperamos que lo disfrutes!`, tag: `pedido-${id}` };
      sendPushToUser(result[0].usuarioId ?? null, msg).catch(console.error);
    }

    return c.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.get('/api/admin/pedidos', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const limit  = Math.min(Number.parseInt(c.req.query('limit') || '100'), 500);
    const offset = Math.max(Number.parseInt(c.req.query('offset') || '0'), 0);
    const rows = await db.select().from(pedidos)
      .orderBy(desc(pedidos.fecha))
      .limit(limit)
      .offset(offset);
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/admin/pedidos/:id', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.delete(pedidos).where(eq(pedidos.id, id)).returning({ id: pedidos.id });
    if (!result.length) return c.json({ error: 'Pedido no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'eliminar', 'pedido', id);
    return c.json({ mensaje: 'Pedido eliminado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — CSV EXPORT
// =================================================================

/** Escapa un valor para CSV previniendo inyección de fórmulas */
function csvEscape(v: unknown): string {
  if (v == null) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : `${v as string | number | boolean | bigint}`;
  // Prevenir formula injection: prefijo con comilla si empieza con =, +, -, @, tab, CR
  if (s.length > 0 && ['=', '+', '-', '@', '\t', '\r'].includes(s[0])) {
    s = `'${s}`;
  }
  s = s.replaceAll('"', '""');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    s = `"${s}"`;
  }
  return s;
}

app.get('/api/admin/pedidos/csv', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const rows = await db.select().from(pedidos).orderBy(desc(pedidos.fecha));
    const lines = [
      'ID,Cliente,Email,Dirección,Subtotal,Impuestos,Envío,Descuento,Total,Estado,Fecha',
      ...rows.map(p =>
        [p.id, p.cliente, p.email, p.direccion, p.subtotal ?? '', p.impuestos ?? '', p.envio ?? '', p.descuento ?? 0, p.total, p.estado, p.fecha?.toISOString() ?? '']
          .map(csvEscape).join(',')
      ),
    ];
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="pedidos.csv"');
    return c.body(lines.join('\n'));
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error al exportar' }, 500);
  }
});

app.get('/api/admin/productos/csv', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const rows = await db.select().from(productos).orderBy(asc(productos.id));
    const lines = [
      'ID,Nombre,Categoría,Precio,Stock,SKU,Destacado,Activo',
      ...rows.map(p =>
        [p.id, p.nombre, p.categoria, p.precio, p.stock, p.sku ?? '', p.destacado, p.activo]
          .map(csvEscape).join(',')
      ),
    ];
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="productos.csv"');
    return c.body(lines.join('\n'));
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error al exportar' }, 500);
  }
});

// =================================================================
// RUTAS — CATEGORÍAS
// =================================================================
app.get('/api/categorias', async (c) => {
  try {
    const rows = await db.select().from(categorias).orderBy(asc(categorias.orden), asc(categorias.nombre));
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/categorias', authenticate, requireAdmin, zValidator('json', CategoriaSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const [row] = await db.insert(categorias).values({
      nombre:      sanitizeText(data.nombre),
      descripcion: sanitizeText(data.descripcion || ''),
      imagen:      data.imagen || '',
      orden:       data.orden ?? 0,
      activa:      data.activa ?? true,
    }).returning({ id: categorias.id });
    const u = c.get('user'); await logAudit(u.id, u.username, 'crear', 'categoria', row.id, `Nombre: ${sanitizeText(data.nombre)}`);
    return c.json({ id: row.id, mensaje: 'Categoría creada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.put('/api/categorias/:id', authenticate, requireAdmin, zValidator('json', CategoriaSchema), async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');
    const result = await db.update(categorias).set({
      nombre:      sanitizeText(data.nombre),
      descripcion: sanitizeText(data.descripcion || ''),
      imagen:      data.imagen || '',
      orden:       data.orden ?? 0,
      activa:      data.activa ?? true,
    }).where(eq(categorias.id, id)).returning({ id: categorias.id });
    if (!result.length) return c.json({ error: 'Categoría no encontrada' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'actualizar', 'categoria', id, `Nombre: ${sanitizeText(data.nombre)}`);
    return c.json({ mensaje: 'Categoría actualizada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/categorias/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    await db.delete(categorias).where(eq(categorias.id, id));
    const u = c.get('user'); await logAudit(u.id, u.username, 'eliminar', 'categoria', id);
    return c.json({ mensaje: 'Categoría eliminada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — CUPONES
// =================================================================
app.get('/api/admin/cupones', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const rows = await db.select().from(cupones).orderBy(desc(cupones.createdAt));
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/admin/cupones', authenticate, requireTwoFactorVerified, requireAdmin, zValidator('json', CuponSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const [row] = await db.insert(cupones).values({
      codigo:      data.codigo.toUpperCase(),
      tipo:        data.tipo,
      valor:       data.valor,
      minCompra:   data.minCompra ?? 0,
      maxUsos:     data.maxUsos,
      activo:      data.activo ?? true,
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : null,
      fechaFin:    data.fechaFin ? new Date(data.fechaFin) : null,
    }).returning({ id: cupones.id });
    const u = c.get('user'); await logAudit(u.id, u.username, 'crear', 'cupon', row.id, `Código: ${data.codigo.toUpperCase()}`);
    return c.json({ id: row.id, mensaje: 'Cupón creado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/admin/cupones/:id', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    await db.delete(cupones).where(eq(cupones.id, id));
    const u = c.get('user'); await logAudit(u.id, u.username, 'eliminar', 'cupon', id);
    return c.json({ mensaje: 'Cupón eliminado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Validate coupon (public)
app.post('/api/cupones/validar', zValidator('json', ValidarCuponSchema), async (c) => {
  try {
    const { codigo, subtotal } = c.req.valid('json');
    const [cup] = await db.select().from(cupones).where(eq(cupones.codigo, codigo.toUpperCase()));
    if (!cup?.activo) return c.json({ error: 'Cupón no válido' }, 404);

    const now = new Date();
    if (cup.fechaInicio && new Date(cup.fechaInicio) > now) return c.json({ error: 'Cupón aún no activo' }, 400);
    if (cup.fechaFin && new Date(cup.fechaFin) < now) return c.json({ error: 'Cupón expirado' }, 400);
    if (cup.maxUsos && (cup.usosActuales ?? 0) >= cup.maxUsos) return c.json({ error: 'Cupón agotado' }, 400);
    if (subtotal < (cup.minCompra ?? 0)) return c.json({ error: `Compra mínima: €${cup.minCompra}` }, 400);

    const descuento = cup.tipo === 'porcentaje'
      ? Math.round(subtotal * (cup.valor / 100) * 100) / 100
      : Math.min(cup.valor, subtotal);

    return c.json({ valido: true, descuento, tipo: cup.tipo, valor: cup.valor });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — FAVORITOS
// =================================================================
app.get('/api/favoritos', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const rows = await db.select({
      id:         favoritos.id,
      productoId: favoritos.productoId,
      createdAt:  favoritos.createdAt,
      nombre:     productos.nombre,
      precio:     productos.precio,
      imagen:     productos.imagen,
      stock:      productos.stock,
    }).from(favoritos)
      .innerJoin(productos, eq(favoritos.productoId, productos.id))
      .where(eq(favoritos.usuarioId, user.id));
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/favoritos/:productoId', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const productoId = Number.parseInt(c.req.param('productoId'));
    if (Number.isNaN(productoId)) return c.json({ error: 'ID inválido' }, 400);

    const [existing] = await db.select({ id: favoritos.id }).from(favoritos)
      .where(and(eq(favoritos.usuarioId, user.id), eq(favoritos.productoId, productoId)));
    if (existing) return c.json({ mensaje: 'Ya está en favoritos' });

    await db.insert(favoritos).values({ usuarioId: user.id, productoId });
    return c.json({ mensaje: 'Añadido a favoritos' }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/favoritos/:productoId', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const productoId = Number.parseInt(c.req.param('productoId'));
    if (Number.isNaN(productoId)) return c.json({ error: 'ID inválido' }, 400);

    await db.delete(favoritos).where(and(eq(favoritos.usuarioId, user.id), eq(favoritos.productoId, productoId)));
    return c.json({ mensaje: 'Eliminado de favoritos' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// MIDDLEWARE — Honeypot Auth (detecta bots que rellenan campo oculto)
// =================================================================
const honeypotAuth: MiddlewareHandler = async (c, next) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const website = (body.website || '').toString().trim();
    if (website) {
      const ip = getClientIP(c);
      await anomalyDetector.logSecurityEvent(ip, 'bot_detected', undefined, `Honeypot rellenado: "${website.slice(0, 100)}"`);
      await anomalyDetector.blockIp(ip, 'bot_detected: honeypot rellenado en formulario auth');
      appendLog(`[${new Date().toISOString()}] BOT_DETECTED ip=${ip} honeypot="${website.slice(0, 50)}"\n`);
      return c.json({ error: 'Error de validación' }, 400);
    }
  } catch (err) { console.error('[honeypotAuth]', err); }
  await next();
};

// =================================================================
// RUTAS — AUTH
// =================================================================
app.post('/api/register', honeypotAuth, loginRateLimiter, zValidator('json', RegisterSchema), async (c) => {
  const { username, password, email, nombre } = c.req.valid('json');
  try {
    const [existingAdmin] = await db.select({ id: usuarios.id }).from(usuarios)
      .where(and(or(eq(usuarios.username, username), eq(usuarios.email, email)), eq(usuarios.role, 'admin')));
    const existingClientByUsername = await getClientUserByUsername(username);
    const existingClientByEmail = await getClientUserByEmail(email);
    if (existingAdmin || existingClientByUsername || existingClientByEmail) return c.json({ error: 'El usuario o email ya existe' }, 409);

    const hashedPassword = await argon2.hash(password);
    const cleanUsername = sanitizeText(username);
    const cleanNombre = nombre ? sanitizeText(nombre) : null;
    await clientPool.query(
      `INSERT INTO client_users (username, password, email, nombre, idioma, puntos)
       VALUES ($1, $2, $3, $4, 'es', 0)`,
      [cleanUsername, hashedPassword, email, cleanNombre],
    );
    const user = await ensureClientShadowUser({
      username: cleanUsername,
      password: hashedPassword,
      email,
      nombre: cleanNombre,
      idioma: 'es',
      puntos: 0,
    });

    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { id: user.id, username: user.username, role: 'standard', avatar: null, createdAt: Date.now() };

    return c.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: 'standard', email, nombre: cleanNombre, puntos: 0 },
      message: 'Cuenta creada correctamente',
    }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/login', honeypotAuth, loginRateLimiter, zValidator('json', LoginSchema), async (c) => {
  const { username, password } = c.req.valid('json');
  const ip = getClientIP(c);

  function recordFailed() {
    if (!loginAttempts[ip]) loginAttempts[ip] = { count: 0, blockedUntil: null };
    loginAttempts[ip].count += 1;
    loginAttempts[ip].lastAttempt = Date.now();
    if (loginAttempts[ip].count >= MAX_ATTEMPTS) {
      loginAttempts[ip].blockedUntil = Date.now() + BLOCK_DURATION;
      appendLog(`[${new Date().toISOString()}] BLOQUEADO ip=${ip}\n`);
      logSecEvent('brute_force', { ip, username, endpoint: '/api/login', metodo: 'POST', userAgent: c.req.header('user-agent'), detalles: `Bloqueado tras ${MAX_ATTEMPTS} intentos` });
      autoBlockIp(ip, `brute_force login (${MAX_ATTEMPTS} intentos fallidos)`);
    }
  }

  try {
    const [adminUser] = await db.select().from(usuarios)
      .where(and(eq(usuarios.username, username), eq(usuarios.role, 'admin')));
    let user: any = adminUser;
    if (!user) {
      const clientUser = await getClientUserByUsername(username);
      if (clientUser) {
        const shadowUser = await ensureClientShadowUser(clientUser);
        user = {
          ...shadowUser,
          password: clientUser.password,
          avatar: clientUser.avatar,
          nombre: clientUser.nombre,
          email: clientUser.email,
          puntos: clientUser.puntos ?? 0,
          role: 'standard',
        };
      }
    }
    let passwordValida = false;
    if (adminUser) {
      try { passwordValida = await argon2.verify(adminUser.password, password); }
      catch { passwordValida = false; }
    }
    if (!user || !passwordValida) {
      recordFailed();
      logSecEvent('login_fail', { ip, username, endpoint: '/api/login', metodo: 'POST', userAgent: c.req.header('user-agent'), detalles: user ? 'Contraseña incorrecta' : 'Usuario no existe' });
      return c.json({ error: 'Credenciales incorrectas' }, 401);
    }
    delete loginAttempts[ip];
    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { id: user.id, username: user.username, role: user.role ?? 'standard', avatar: user.avatar ?? null, createdAt: Date.now() };
    logSecEvent('login_ok', { ip, username, endpoint: '/api/login', metodo: 'POST', userAgent: c.req.header('user-agent'), detalles: `Sesión iniciada, role=${user.role}` });
    return c.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar, nombre: user.nombre, email: user.email, puntos: user.puntos ?? 0 },
      message: 'Inicio de sesión correcto',
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

const socLoginHandler = async (c: any) => {
  const { username, password } = c.req.valid('json');
  const ip = getClientIP(c);

  try {
    const result = await socPool.query(
      'SELECT id, username, password FROM soc_admins WHERE username = $1',
      [username],
    );
    const admin = result.rows[0];
    let passwordValida = false;
    if (admin?.password) {
      try { passwordValida = await argon2.verify(admin.password, password); }
      catch { passwordValida = false; }
    }
    if (!admin || !passwordValida) {
      await logSecEvent('login_fail', {
        ip,
        username,
        endpoint: '/api/security/login',
        metodo: 'POST',
        userAgent: c.req.header('user-agent'),
        detalles: 'Credenciales SOC incorrectas',
      });
      return c.json({ error: 'Credenciales SOC incorrectas' }, 401);
    }

    const token = crypto.randomBytes(32).toString('hex');
    socSessions[token] = { id: admin.id, username: admin.username, createdAt: Date.now() };
    await logSecEvent('login_ok', {
      ip,
      username,
      endpoint: '/api/security/login',
      metodo: 'POST',
      userAgent: c.req.header('user-agent'),
      detalles: 'Sesion SOC iniciada',
    });
    return c.json({
      success: true,
      token,
      user: { id: admin.id, username: admin.username, role: 'soc_admin' },
      message: 'Inicio de sesion SOC correcto',
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
};

app.post('/api/security/login', loginRateLimiter, zValidator('json', LoginSchema), socLoginHandler);
app.post('/api/panel/login', loginRateLimiter, zValidator('json', LoginSchema), socLoginHandler);

app.post('/api/logout', (c) => {
  const token = c.req.header('authorization');
  if (token && sessions[token]) delete sessions[token];
  if (token && socSessions[token]) delete socSessions[token];
  return c.json({ message: 'Sesión cerrada' });
});

const socLogoutHandler = (c: any) => {
  const token = c.req.header('authorization');
  if (token && socSessions[token]) delete socSessions[token];
  return c.json({ message: 'Sesion SOC cerrada' });
};

app.post('/api/security/logout', socLogoutHandler);
app.post('/api/panel/logout', socLogoutHandler);

app.get('/api/usuario', authenticate, (c) => {
  return c.json({ user: c.get('user') });
});

// Puntos de fidelidad del usuario autenticado
app.get('/api/usuario/puntos', authenticate, async (c) => {
  try {
    const user = c.get('user');
    const [row] = await db.select({ puntos: usuarios.puntos }).from(usuarios).where(eq(usuarios.id, user.id));
    return c.json({ puntos: row?.puntos ?? 0 });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Soft-delete de usuario (admin)
app.delete('/api/admin/usuarios/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.update(usuarios).set({ deletedAt: new Date() }).where(and(eq(usuarios.id, id), isNull(usuarios.deletedAt))).returning({ id: usuarios.id });
    if (!result.length) return c.json({ error: 'Usuario no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'eliminar', 'usuario', id);
    return c.json({ mensaje: 'Usuario eliminado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Restaurar usuario desde papelera (admin)
app.post('/api/admin/usuarios/:id/restaurar', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.update(usuarios).set({ deletedAt: null }).where(eq(usuarios.id, id)).returning({ id: usuarios.id });
    if (!result.length) return c.json({ error: 'Usuario no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'restaurar', 'usuario', id);
    return c.json({ mensaje: 'Usuario restaurado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Restaurar producto desde papelera (admin)
app.post('/api/admin/productos/:id/restaurar', authenticate, requireAdmin, async (c) => {
  try {
    const id = Number.parseInt(c.req.param('id'));
    if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.update(productos).set({ deletedAt: null }).where(eq(productos.id, id)).returning({ id: productos.id });
    if (!result.length) return c.json({ error: 'Producto no encontrado' }, 404);
    const u = c.get('user'); await logAudit(u.id, u.username, 'restaurar', 'producto', id);
    return c.json({ mensaje: 'Producto restaurado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Papelera: productos y usuarios eliminados (admin)
app.get('/api/admin/papelera', authenticate, requireAdmin, async (c) => {
  try {
    const productosEliminados = await db.select({
      id: productos.id, nombre: productos.nombre, precio: productos.precio,
      imagen: productos.imagen, deletedAt: productos.deletedAt,
    }).from(productos).where(sql`${productos.deletedAt} IS NOT NULL`);

    const usuariosEliminados = await db.select({
      id: usuarios.id, username: usuarios.username, email: usuarios.email,
      nombre: usuarios.nombre, role: usuarios.role, deletedAt: usuarios.deletedAt,
    }).from(usuarios).where(sql`${usuarios.deletedAt} IS NOT NULL`);

    return c.json({ productos: productosEliminados, usuarios: usuariosEliminados });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.put('/api/usuario/perfil', authenticate, zValidator('json', PerfilSchema), async (c) => {
  try {
    const user = c.get('user');
    const data = c.req.valid('json');
    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = sanitizeText(data.nombre);
    if (data.email !== undefined) updateData.email = data.email;
    if (data.direccion !== undefined) updateData.direccion = sanitizeText(data.direccion);
    if (data.telefono !== undefined) updateData.telefono = data.telefono;
    if (data.idioma !== undefined) updateData.idioma = data.idioma;

    await db.update(usuarios).set(updateData).where(eq(usuarios.id, user.id));
    if (user.role !== 'admin') {
      const sets: string[] = [];
      const values: unknown[] = [];
      let idx = 1;
      for (const [key, value] of Object.entries(updateData)) {
        sets.push(`${key} = $${idx++}`);
        values.push(value);
      }
      if (sets.length) {
        values.push(user.username);
        await clientPool.query(`UPDATE client_users SET ${sets.join(', ')} WHERE username = $${idx}`, values);
      }
    }
    return c.json({ mensaje: 'Perfil actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/usuario/avatar', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const body = await c.req.parseBody();
    const file = body['avatar'];
    if (!file || typeof file === 'string')
      return c.json({ error: 'No se proporcionó imagen' }, 400);

    const avatarUrl = await handleFileUpload(file as File, 'avatars', 2 * 1024 * 1024);
    await db.update(usuarios).set({ avatar: avatarUrl }).where(eq(usuarios.id, user.id));

    const token = c.req.header('authorization') ?? '';
    if (token && sessions[token]) sessions[token].avatar = avatarUrl;

    return c.json({ success: true, avatar: avatarUrl, message: 'Avatar actualizado' });
  } catch (err: any) {
    if (err.status === 400) return c.json({ error: err.message }, 400);
    console.error(err);
    return c.json({ error: 'Error al subir la imagen' }, 500);
  }
});

app.put('/api/usuario/password', authenticate, zValidator('json', CambiarPasswordSchema), async (c) => {
  try {
    const user = c.get('user');
    const { passwordActual, passwordNueva } = c.req.valid('json');
    let row;
    if (user.role === 'admin') {
      [row] = await db.select().from(usuarios).where(eq(usuarios.id, user.id));
    } else {
      row = await getClientUserByUsername(user.username);
    }
    if (!row) return c.json({ error: 'Usuario no encontrado' }, 404);
    const valida = await argon2.verify(row.password, passwordActual);
    if (!valida) return c.json({ error: 'Contraseña actual incorrecta' }, 400);
    const hash = await argon2.hash(passwordNueva);
    await db.update(usuarios).set({ password: hash }).where(eq(usuarios.id, user.id));
    if (user.role !== 'admin') {
      await clientPool.query('UPDATE client_users SET password = $1 WHERE username = $2', [hash, user.username]);
    }
    // Invalidar todas las sesiones del usuario excepto la actual
    const tokenActual = c.req.header('authorization');
    for (const [t, s] of Object.entries(sessions)) {
      if (s.id === user.id && t !== tokenActual) delete sessions[t];
    }
    return c.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — ADMIN USERS
// =================================================================
app.get('/api/admin/usuarios', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const rows = await db.select({
      id:           usuarios.id,
      username:     usuarios.username,
      email:        usuarios.email,
      nombre:       usuarios.nombre,
      role:         usuarios.role,
      avatar:       usuarios.avatar,
      createdAt:    usuarios.createdAt,
      totalPedidos: sql<number>`COUNT(${pedidos.id})`,
    }).from(usuarios)
      .leftJoin(pedidos, eq(pedidos.usuarioId, usuarios.id))
      .groupBy(usuarios.id)
      .orderBy(desc(usuarios.createdAt));
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — SECURITY OPERATIONS CENTER
// =================================================================
const socEventsHandler = async (c: any) => {
  try {
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);
    const tipo  = c.req.query('tipo');
    const rows  = await db.select().from(securityEvents)
      .where(tipo ? eq(securityEvents.tipo, tipo) : undefined)
      .orderBy(desc(securityEvents.fecha))
      .limit(limit);
    return c.json(rows);
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
};

app.get('/api/security/events', authenticateSoc, socEventsHandler);
app.get('/api/panel/events', authenticateSoc, socEventsHandler);

const socStatsHandler = async (c: any) => {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total]    = await db.select({ c: count() }).from(securityEvents).where(gte(securityEvents.fecha, since24h));
    const [fails]    = await db.select({ c: count() }).from(securityEvents).where(and(eq(securityEvents.tipo, 'login_fail'), gte(securityEvents.fecha, since24h)));
    const [oks]      = await db.select({ c: count() }).from(securityEvents).where(and(eq(securityEvents.tipo, 'login_ok'),   gte(securityEvents.fecha, since24h)));
    const [brutes]   = await db.select({ c: count() }).from(securityEvents).where(and(eq(securityEvents.tipo, 'brute_force'), gte(securityEvents.fecha, since24h)));
    const [invalids] = await db.select({ c: count() }).from(securityEvents).where(and(eq(securityEvents.tipo, 'auth_invalid'), gte(securityEvents.fecha, since24h)));

    // Unique IPs last 24h
    const ipsResult = await db.selectDistinct({ ip: securityEvents.ip }).from(securityEvents)
      .where(and(sql`${securityEvents.ip} IS NOT NULL`, gte(securityEvents.fecha, since24h)));

    // Top IPs (by event count)
    const topIps = await db.select({ ip: securityEvents.ip, c: count() })
      .from(securityEvents)
      .where(and(sql`${securityEvents.ip} IS NOT NULL`, gte(securityEvents.fecha, since24h)))
      .groupBy(securityEvents.ip)
      .orderBy(desc(count()))
      .limit(10);

    // Events per hour (last 24h)
    const hourly = await pool.query(`
      SELECT date_trunc('hour', fecha) AS hora,
             tipo,
             COUNT(*)::int AS total
      FROM security_events
      WHERE fecha >= NOW() - INTERVAL '24 hours'
      GROUP BY hora, tipo
      ORDER BY hora ASC
    `);

    // Active sessions count
    const activeSessions = Object.keys(socSessions).filter(t => Date.now() - socSessions[t].createdAt < SOC_SESSION_TTL).length;

    return c.json({
      total:          Number(total.c),
      login_fail:     Number(fails.c),
      login_ok:       Number(oks.c),
      brute_force:    Number(brutes.c),
      auth_invalid:   Number(invalids.c),
      unique_ips:     ipsResult.length,
      active_sessions: activeSessions,
      top_ips:        topIps.map(r => ({ ip: r.ip, count: Number(r.c) })),
      hourly:         hourly.rows,
    });
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
};

app.get('/api/security/stats', authenticateSoc, socStatsHandler);
app.get('/api/panel/stats', authenticateSoc, socStatsHandler);

// =================================================================
// RUTAS — THREAT INTELLIGENCE (VirusTotal)
// =================================================================
const vtCache: Record<string, { data: object; cachedAt: number }> = {};
const VT_CACHE_TTL = 60 * 60 * 1000; // 1h — no quemar cuota en cada refresh

const VALID_IP = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]{2,39}$/;

const socThreatHandler = async (c: any) => {
  const ip = c.req.param('ip');

  if (!VALID_IP.test(ip)) return c.json({ error: 'IP inválida' }, 400);

  // Devolver caché si está fresca
  const cached = vtCache[ip];
  if (cached && Date.now() - cached.cachedAt < VT_CACHE_TTL) {
    return c.json({ ...cached.data, cached: true });
  }

  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return c.json({ error: 'VIRUSTOTAL_API_KEY no configurada en .env' }, 503);

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(ip)}`, {
      headers: { 'x-apikey': apiKey },
    });

    if (res.status === 404) return c.json({ error: 'IP no encontrada en VirusTotal' }, 404);
    if (res.status === 429) return c.json({ error: 'Límite de API VirusTotal alcanzado. Intenta en 1 minuto.' }, 429);
    if (!res.ok) return c.json({ error: `Error VirusTotal: HTTP ${res.status}` }, 502);

    const vt = await res.json() as Record<string, any>;
    const attrs = vt.data?.attributes ?? {};
    const stats = attrs.last_analysis_stats ?? {};

    const result = {
      ip,
      malicious:  Number(stats.malicious  ?? 0),
      suspicious: Number(stats.suspicious ?? 0),
      harmless:   Number(stats.harmless   ?? 0),
      undetected: Number(stats.undetected ?? 0),
      reputation: Number(attrs.reputation ?? 0),
      country:    attrs.country   ?? null,
      as_owner:   attrs.as_owner  ?? null,
      network:    attrs.network   ?? null,
      cached: false,
    };

    vtCache[ip] = { data: result, cachedAt: Date.now() };
    return c.json(result);
  } catch (err) {
    console.error('VirusTotal error:', err);
    return c.json({ error: 'Error consultando VirusTotal' }, 502);
  }
};

app.get('/api/security/ip/:ip/threat', authenticateSoc, socThreatHandler);
app.get('/api/panel/ip/:ip/threat', authenticateSoc, socThreatHandler);

// =================================================================
// RUTAS — BLOCKED IPs (SOC)
// =================================================================
const socBlockedIpsListHandler = async (c: any) => {
  try {
    const rows = await db.select().from(blockedIps).orderBy(desc(blockedIps.createdAt));
    return c.json(rows);
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
};

app.get('/api/security/blocked-ips', authenticateSoc, socBlockedIpsListHandler);
app.get('/api/panel/blocked-ips', authenticateSoc, socBlockedIpsListHandler);

const socBlockedIpsCreateHandler = async (c: any) => {
  try {
    const body = await c.req.json();
    const ip = String(body.ip || '').trim();
    const motivo = String(body.motivo || 'manual').slice(0, 200);
    const horas  = Math.min(Number(body.horas || 24), 8760);
    if (!VALID_IP.test(ip)) return c.json({ error: 'IP inválida' }, 400);
    const hasta = horas > 0 ? new Date(Date.now() + horas * 60 * 60 * 1000) : null;
    await pool.query(
      `INSERT INTO blocked_ips (ip, motivo, bloqueado_hasta)
       VALUES ($1, $2, $3)
       ON CONFLICT (ip) DO UPDATE SET motivo = $2, bloqueado_hasta = $3, created_at = NOW()`,
      [ip, motivo, hasta?.toISOString() ?? null]
    );
    blockedIpSet.add(ip);
    logSecEvent('blocked_request', { ip, detalles: `Bloqueada manualmente: ${motivo}` });
    return c.json({ ok: true });
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
};

app.post('/api/security/blocked-ips', authenticateSoc, socBlockedIpsCreateHandler);
app.post('/api/panel/blocked-ips', authenticateSoc, socBlockedIpsCreateHandler);

const socBlockedIpsDeleteHandler = async (c: any) => {
  const ip = decodeURIComponent(c.req.param('ip'));
  try {
    await db.delete(blockedIps).where(eq(blockedIps.ip, ip));
    blockedIpSet.delete(ip);
    return c.json({ ok: true });
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
};

app.delete('/api/security/blocked-ips/:ip', authenticateSoc, socBlockedIpsDeleteHandler);
app.delete('/api/panel/blocked-ips/:ip', authenticateSoc, socBlockedIpsDeleteHandler);

// =================================================================
// RUTAS — SOC EXPORT (CSV / JSON)
// =================================================================
const socEventsExportHandler = async (c: any) => {
  const format = c.req.query('format') === 'csv' ? 'csv' : 'json';
  const limit  = Math.min(Number(c.req.query('limit') || 1000), 5000);
  try {
    const rows = await db.select().from(securityEvents)
      .orderBy(desc(securityEvents.fecha))
      .limit(limit);

    if (format === 'csv') {
      const header = 'id,tipo,ip,username,endpoint,metodo,user_agent,detalles,fecha';
      const lines = rows.map(r =>
        [r.id, r.tipo, r.ip, r.username, r.endpoint, r.metodo, r.userAgent, r.detalles, r.fecha?.toISOString()].map(csvEscape).join(',')
      );
      return new Response([header, ...lines].join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="soc-events-${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="soc-events-${new Date().toISOString().slice(0,10)}.json"`,
      },
    });
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
};

app.get('/api/security/events/export', authenticateSoc, socEventsExportHandler);
app.get('/api/panel/events/export', authenticateSoc, socEventsExportHandler);

// =================================================================
// RUTAS — HONEYPOT (trampa para bots / scanners)
// =================================================================
const HONEYPOT_PATHS = [
  '/wp-login.php', '/wp-admin', '/wp-config.php', '/xmlrpc.php',
  '/.env', '/.git/config', '/.htaccess',
  '/admin.php', '/phpmyadmin', '/config.php', '/login.php',
  '/shell.php', '/backup.sql', '/db.sql',
];
for (const hpath of HONEYPOT_PATHS) {
  app.all(hpath, async (c) => {
    const ip = getClientIP(c);
    logSecEvent('honeypot', { ip, endpoint: hpath, metodo: c.req.method, userAgent: c.req.header('user-agent'), detalles: `Honeypot activado: ${hpath}` });
    autoBlockIp(ip, `honeypot: ${hpath}`);
    return c.json({ error: 'Not Found' }, 404);
  });
}

// =================================================================
// RUTAS — ADMIN VALORACIONES (reseñas)
// =================================================================
app.get('/api/admin/valoraciones', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const rows = await db.select({
      id:         valoraciones.id,
      puntuacion: valoraciones.puntuacion,
      titulo:     valoraciones.titulo,
      comentario: valoraciones.comentario,
      fecha:      valoraciones.fecha,
      username:   usuarios.username,
      avatar:     usuarios.avatar,
      productoId: valoraciones.productoId,
      productoNombre: productos.nombre,
    }).from(valoraciones)
      .innerJoin(usuarios, eq(valoraciones.usuarioId, usuarios.id))
      .innerJoin(productos, eq(valoraciones.productoId, productos.id))
      .orderBy(desc(valoraciones.fecha));
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/admin/valoraciones/:id', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
  try {
    await db.delete(valoraciones).where(eq(valoraciones.id, id));
    const u = c.get('user'); await logAudit(u.id, u.username, 'eliminar', 'valoracion', id);
    return c.json({ ok: true });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — AUDIT LOG
// =================================================================
app.get('/api/admin/audit-log', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const limit  = Math.min(Number(c.req.query('limit') || 200), 500);
    const offset = Math.max(Number(c.req.query('offset') || 0), 0);
    const entidad = c.req.query('entidad');
    const rows = await db.select().from(auditLog)
      .where(entidad ? eq(auditLog.entidad, entidad) : undefined)
      .orderBy(desc(auditLog.fecha))
      .limit(limit)
      .offset(offset);
    return c.json(rows);
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
});

// =================================================================
// RUTAS — ADMIN ANALYTICS
// =================================================================
app.get('/api/admin/analytics', authenticate, requireTwoFactorVerified, requireAdmin, async (c) => {
  try {
    const [productCount] = await db.select({ count: count() }).from(productos);
    const [orderCount] = await db.select({ count: count() }).from(pedidos);
    const [userCount] = await db.select({ count: count() }).from(usuarios);
    const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(${pedidos.total}), 0)` }).from(pedidos);
    const [avgTicket] = await db.select({ avg: sql<number>`COALESCE(AVG(${pedidos.total}), 0)` }).from(pedidos);

    // Orders by day (last 30 days)
    const ordersByDay = await db.select({
      fecha: sql<string>`TO_CHAR(${pedidos.fecha}, 'YYYY-MM-DD')`,
      total: sql<number>`SUM(${pedidos.total})`,
      count: count(),
    }).from(pedidos)
      .where(sql`${pedidos.fecha} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`TO_CHAR(${pedidos.fecha}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${pedidos.fecha}, 'YYYY-MM-DD')`);

    // Orders by status
    const ordersByStatus = await db.select({
      estado: pedidos.estado,
      count: count(),
    }).from(pedidos).groupBy(pedidos.estado);

    // Top products
    const topProducts = await db.select({
      productoId: pedidoItems.productoId,
      nombre:     productos.nombre,
      vendidos:   sql<number>`SUM(${pedidoItems.cantidad})`,
      ingresos:   sql<number>`SUM(${pedidoItems.cantidad} * ${pedidoItems.precio})`,
    }).from(pedidoItems)
      .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
      .groupBy(pedidoItems.productoId, productos.nombre)
      .orderBy(sql`SUM(${pedidoItems.cantidad}) DESC`)
      .limit(10);

    // Low stock products
    const lowStock = await db.select().from(productos)
      .where(sql`${productos.stock} <= 5 AND ${productos.activo} = true`)
      .orderBy(asc(productos.stock))
      .limit(10);

    return c.json({
      totalProductos: Number(productCount.count),
      totalPedidos:   Number(orderCount.count),
      totalUsuarios:  Number(userCount.count),
      ingresosTotales: Number(revenue.total),
      ticketPromedio:  Math.round(Number(avgTicket.avg) * 100) / 100,
      pedidosPorDia:   ordersByDay,
      pedidosPorEstado: ordersByStatus,
      topProductos:    topProducts,
      stockBajo:       lowStock,
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — PUSH SUBSCRIPTIONS
// =================================================================
app.post('/api/push/subscribe', optionalAuth, zValidator('json', PushSubscriptionSchema), async (c) => {
  try {
    const { endpoint, keys } = c.req.valid('json');
    const user = c.get('user');

    const [existing] = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    if (existing) return c.json({ mensaje: 'Ya suscrito' });

    await db.insert(pushSubscriptions).values({
      usuarioId: user?.id ?? null,
      endpoint,
      p256dh:    keys.p256dh,
      auth:      keys.auth,
    });
    return c.json({ mensaje: 'Suscripción registrada' }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — STRIPE CHECKOUT
// =================================================================
app.post('/api/pedidos/checkout', checkoutRateLimiter, optionalAuth, zValidator('json', PedidoSchema), async (c) => {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_REEMPLAZA')) {
    return c.json({ error: 'Stripe no configurado. Añade STRIPE_SECRET_KEY en backend/.env' }, 503);
  }

  const { cliente, email, direccion, items, cupon } = c.req.valid('json');
  const user = c.get('user');

  try {
    const result = await crearPedido({ cliente, email, direccion, items, cupon, userId: user?.id });

    // Create Stripe PaymentIntent (amount in cents)
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(result.total * 100),
      currency: 'eur',
      metadata: { pedidoId: String(result.id) },
      automatic_payment_methods: { enabled: true },
    });

    return c.json({ clientSecret: paymentIntent.client_secret, pedidoId: result.id, total: result.total });
  } catch (err: any) {
    if (err.message === 'PRODUCT_NOT_FOUND')
      return c.json({ error: 'Uno o más artículos no están disponibles' }, 400);
    if (err.code === 'INSUFFICIENT_STOCK')
      return c.json({ error: err.message }, 400);
    console.error(err);
    return c.json({ error: 'Error al procesar el pedido' }, 500);
  }
});

// =================================================================
// RUTAS — STRIPE WEBHOOK
// =================================================================
app.post('/api/webhook', async (c) => {
  const rawBody = await c.req.text();
  const sig     = c.req.header('stripe-signature') || '';
  const secret  = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!secret || secret.startsWith('whsec_REEMPLAZA')) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET no configurado — rechazando webhook');
    return c.json({ error: 'Webhook secret not configured' }, 500);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error('[webhook] Firma inválida:', err.message);
    return c.json({ error: `Webhook Error: ${err.message}` }, 400);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    const pedidoId = Number.parseInt(pi.metadata?.pedidoId || '');
    if (!Number.isNaN(pedidoId)) {
      try {
        await db.update(pedidos).set({ estado: 'pagado' }).where(eq(pedidos.id, pedidoId));
        console.log(`[webhook] Pedido #${pedidoId} marcado como pagado`);
      } catch (err) {
        console.error('[webhook] Error al actualizar pedido:', err);
      }
    }
  }

  return c.json({ received: true });
});

// =================================================================
// RUTAS — CÁLCULO ENVÍO/IMPUESTOS (público)
// =================================================================
app.get('/api/calcular-costes', (c) => {
  const subtotal = Number.parseFloat(c.req.query('subtotal') || '0');
  const envio = calcularEnvio(subtotal);
  const impuestos = calcularImpuestos(subtotal);
  const total = Math.round((subtotal + impuestos + envio) * 100) / 100;
  return c.json({ subtotal, envio, impuestos, total, envioGratisMinimo: ENVIO_GRATIS_MINIMO, ivaRate: IVA_RATE });
});

// =================================================================
// RUTAS — RECUPERACIÓN DE CONTRASEÑA
// =================================================================
app.post('/api/forgot-password', generalRateLimiter, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().email().max(254) }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'Email inválido' }, 400);
  const { email } = parsed.data;

  // Respuesta siempre 200 para no revelar si el email existe (anti-enumeración)
  const ok = { ok: true, message: 'Si ese email está registrado, recibirás un enlace en breve.' };

  try {
    const user = await getClientUserByEmail(email.toLowerCase().trim());

    if (!user?.email) return c.json(ok);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await clientPool.query(
      'INSERT INTO customer_password_reset_tokens (username, token, expires_at) VALUES ($1, $2, $3)',
      [user.username, token, expiresAt.toISOString()],
    );
    await sendResetEmail(user.email, token, user.username);

    return c.json(ok);
  } catch (err) {
    console.error('forgot-password error:', err);
    return c.json(ok);
  }
});

app.post('/api/reset-password', generalRateLimiter, async (c) => {
  const { token, password } = await c.req.json().catch(() => ({}));
  if (!token || !password || typeof token !== 'string' || typeof password !== 'string')
    return c.json({ error: 'Token y contraseña requeridos' }, 400);
  if (password.length < 8)
    return c.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);

  try {
    const now = new Date();
    const result = await clientPool.query(
      `SELECT id, username, expires_at, used_at
       FROM customer_password_reset_tokens
       WHERE token = $1`,
      [token],
    );
    const record = result.rows[0];

    if (!record) return c.json({ error: 'Enlace inválido o expirado' }, 400);
    if (record.used_at) return c.json({ error: 'Este enlace ya fue utilizado' }, 400);
    if (new Date(record.expires_at) < now) return c.json({ error: 'El enlace ha expirado. Solicita uno nuevo.' }, 400);

    const hash = await argon2.hash(password);
    await clientPool.query('UPDATE client_users SET password = $1 WHERE username = $2', [hash, record.username]);
    await db.update(usuarios).set({ password: hash }).where(eq(usuarios.username, record.username));
    await clientPool.query('UPDATE customer_password_reset_tokens SET used_at = $1 WHERE id = $2', [now.toISOString(), record.id]);

    return c.json({ ok: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('reset-password error:', err);
    return c.json({ error: 'Error interno' }, 500);
  }
});

// =================================================================
// ERROR HANDLER
// =================================================================
app.onError((err, c) => {
  console.error(err);
  if (err.message?.includes('CORS')) return c.json({ error: 'Origen no permitido' }, 403);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));

// =================================================================
// INICIALIZACIÓN
// =================================================================
async function ensureSocDatabaseExists() {
  const adminPool = new PgPool({
    host: SOC_DB_HOST,
    port: SOC_DB_PORT,
    database: 'postgres',
    user: SOC_DB_USER,
    password: SOC_DB_PASSWORD,
  });
  try {
    const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [SOC_DB_NAME]);
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${SOC_DB_NAME.replace(/"/g, '""')}"`);
      console.log(`SOC DB creada: ${SOC_DB_NAME}`);
    }
  } finally {
    await adminPool.end();
  }
}

async function ensureClientDatabaseExists() {
  const adminPool = new PgPool({
    host: CLIENT_DB_HOST,
    port: CLIENT_DB_PORT,
    database: 'postgres',
    user: CLIENT_DB_USER,
    password: CLIENT_DB_PASSWORD,
  });
  try {
    const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [CLIENT_DB_NAME]);
    if (rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${CLIENT_DB_NAME.replace(/"/g, '""')}"`);
      console.log(`CLIENT DB creada: ${CLIENT_DB_NAME}`);
    }
  } finally {
    await adminPool.end();
  }
}

async function waitForClientDB(maxAttempts = 15, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await clientPool.query('SELECT 1');
      console.log('CLIENT PostgreSQL: conexion establecida');
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`CLIENT PostgreSQL: intento ${i}/${maxAttempts} fallido (${msg}). Reintentando en ${delayMs}ms...`);
      if (i === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function initClientDB() {
  await clientPool.query(`
    CREATE TABLE IF NOT EXISTS client_users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT UNIQUE,
      nombre TEXT,
      direccion TEXT,
      telefono TEXT,
      idioma TEXT DEFAULT 'es',
      avatar TEXT,
      puntos INTEGER DEFAULT 0 NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await clientPool.query(`
    CREATE TABLE IF NOT EXISTS customer_password_reset_tokens (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('CLIENT PostgreSQL: tablas verificadas');
}

async function seedClientUsers() {
  const stdUser = process.env.USER_STANDARD ?? 'user';
  const stdPass = process.env.USER_PASS;
  if (!stdPass) {
    console.error('BLOCKER: USER_PASS env var is required');
    process.exit(1);
  }

  const result = await clientPool.query('SELECT id, password, email, nombre, avatar, puntos, idioma, direccion, telefono FROM client_users WHERE username = $1', [stdUser]);
  if (result.rows.length === 0) {
    const hash = await argon2.hash(stdPass);
    await clientPool.query(
      `INSERT INTO client_users (username, password, email, nombre, idioma, puntos)
       VALUES ($1, $2, $3, $4, 'es', 0)`,
      [stdUser, hash, 'user@kratamex.com', 'Usuario Demo'],
    );
    await ensureClientShadowUser({
      username: stdUser,
      password: hash,
      email: 'user@kratamex.com',
      nombre: 'Usuario Demo',
      idioma: 'es',
      puntos: 0,
    });
    console.log('Cliente demo creado');
    return;
  }

  const current = result.rows[0];
  let hash = current.password;
  if (!String(hash).startsWith('$argon2')) {
    hash = await argon2.hash(stdPass);
    await clientPool.query('UPDATE client_users SET password = $1 WHERE username = $2', [hash, stdUser]);
    console.log('Cliente demo migrado a argon2id');
  }
  await ensureClientShadowUser({
    username: stdUser,
    password: hash,
    email: current.email,
    nombre: current.nombre,
    avatar: current.avatar,
    puntos: current.puntos ?? 0,
    idioma: current.idioma,
    direccion: current.direccion,
    telefono: current.telefono,
  });
}

async function waitForSocDB(maxAttempts = 15, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await socPool.query('SELECT 1');
      console.log('SOC PostgreSQL: conexion establecida');
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`SOC PostgreSQL: intento ${i}/${maxAttempts} fallido (${msg}). Reintentando en ${delayMs}ms...`);
      if (i === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

async function initSocDB() {
  await socPool.query(`
    CREATE TABLE IF NOT EXISTS soc_admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('SOC PostgreSQL: tablas verificadas');
}

async function seedSocAdmins() {
  const username = process.env.SOC_ADMIN_USER ?? 'soc_admin';
  const password = process.env.SOC_ADMIN_PASS;
  if (!password) {
    console.error('BLOCKER: SOC_ADMIN_PASS env var is required');
    process.exit(1);
  }

  const result = await socPool.query('SELECT id, password FROM soc_admins WHERE username = $1', [username]);
  if (result.rows.length === 0) {
    await socPool.query(
      'INSERT INTO soc_admins (username, password) VALUES ($1, $2)',
      [username, await argon2.hash(password)],
    );
    console.log('SOC admin creado');
    return;
  }

  const current = result.rows[0];
  if (!String(current.password).startsWith('$argon2')) {
    await socPool.query(
      'UPDATE soc_admins SET password = $1 WHERE id = $2',
      [await argon2.hash(password), current.id],
    );
    console.log('SOC admin migrado a argon2id');
  }
}

async function initDB() {
  const createTableQueries = [
    `CREATE TABLE IF NOT EXISTS categorias (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT    NOT NULL UNIQUE,
      descripcion TEXT,
      imagen      TEXT,
      orden       INTEGER DEFAULT 0,
      activa      BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS usuarios (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      email      TEXT,
      nombre     TEXT,
      direccion  TEXT,
      telefono   TEXT,
      role       TEXT DEFAULT 'standard' CHECK(role IN ('admin','standard')),
      avatar     TEXT,
      idioma     TEXT DEFAULT 'es',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS productos (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT    NOT NULL,
      descripcion TEXT,
      precio      REAL    NOT NULL,
      imagen      TEXT,
      categoria   TEXT,
      stock       INTEGER DEFAULT 0 NOT NULL,
      sku         TEXT,
      destacado   BOOLEAN DEFAULT FALSE,
      activo      BOOLEAN DEFAULT TRUE,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS producto_imagenes (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      orden       INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS pedidos (
      id          SERIAL PRIMARY KEY,
      usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
      cliente     TEXT NOT NULL,
      email       TEXT NOT NULL,
      direccion   TEXT NOT NULL,
      total       REAL NOT NULL,
      subtotal    REAL,
      impuestos   REAL,
      envio       REAL,
      cupon_id    INTEGER,
      descuento   REAL DEFAULT 0,
      estado      TEXT DEFAULT 'pendiente',
      notas       TEXT,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS pedido_items (
      id          SERIAL  PRIMARY KEY,
      pedido_id   INTEGER NOT NULL REFERENCES pedidos(id)   ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
      cantidad    INTEGER NOT NULL,
      precio      REAL    NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS comentarios (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      autor       TEXT    NOT NULL,
      contenido   TEXT    NOT NULL,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS valoraciones (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      puntuacion  INTEGER NOT NULL CHECK(puntuacion BETWEEN 1 AND 5),
      titulo      TEXT,
      comentario  TEXT,
      fecha       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(producto_id, usuario_id)
    )`,
    `CREATE TABLE IF NOT EXISTS favoritos (
      id          SERIAL PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(usuario_id, producto_id)
    )`,
    `CREATE TABLE IF NOT EXISTS cupones (
      id             SERIAL PRIMARY KEY,
      codigo         TEXT NOT NULL UNIQUE,
      tipo           TEXT NOT NULL DEFAULT 'porcentaje',
      valor          REAL NOT NULL,
      min_compra     REAL DEFAULT 0,
      max_usos       INTEGER,
      usos_actuales  INTEGER DEFAULT 0,
      activo         BOOLEAN DEFAULT TRUE,
      fecha_inicio   TIMESTAMPTZ,
      fecha_fin      TIMESTAMPTZ,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          SERIAL PRIMARY KEY,
      usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS security_events (
      id          SERIAL PRIMARY KEY,
      tipo        TEXT NOT NULL,
      ip          TEXT,
      username    TEXT,
      endpoint    TEXT,
      metodo      TEXT,
      user_agent  TEXT,
      detalles    TEXT,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS blocked_ips (
      id              SERIAL PRIMARY KEY,
      ip              TEXT NOT NULL UNIQUE,
      motivo          TEXT,
      bloqueado_hasta TIMESTAMPTZ,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          SERIAL PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token       TEXT NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      used_at     TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )`
  ];

  for (const query of createTableQueries) {
    await pool.query(query);
  }

  // Add new columns to existing tables if they don't exist
  const alterQueries = [
    `ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0 NOT NULL`,
    `ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT`,
    `ALTER TABLE productos ADD COLUMN IF NOT EXISTS destacado BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE productos ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS subtotal REAL`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS impuestos REAL`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio REAL`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupon_id INTEGER`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento REAL DEFAULT 0`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente'`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notas TEXT`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS nombre TEXT`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS direccion TEXT`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono TEXT`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS idioma TEXT DEFAULT 'es'`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS puntos INTEGER DEFAULT 0 NOT NULL`,
    `ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  ];
  for (const q of alterQueries) {
    try { await pool.query(q); } catch (err) { console.error('[migration]', (err as Error).message); }
  }

  // Set default stock for existing products
  await pool.query(`UPDATE productos SET stock = 50 WHERE stock = 0 OR stock IS NULL`);

  console.log('PostgreSQL: tablas verificadas');
}

async function seedProductos() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM productos');
  if (Number.parseInt(result.rows[0].count) > 0) return;
  const data = [
    ['MacBook Pro 14"',           'Apple M3 Pro, 18GB RAM, 512GB SSD, Pantalla Liquid Retina XDR',                    2249, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',   'Portátiles', 25, 'MBP-14-M3'],
    ['Dell XPS 15',               'Intel Core i7-13700H, 32GB RAM, 1TB SSD, NVIDIA RTX 4060, 15.6" 3.5K OLED',       1899, 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&h=300&fit=crop',   'Portátiles', 30, 'DELL-XPS15'],
    ['HP Spectre x360',           'Intel Core i7-1255U, 16GB RAM, 512GB SSD, Pantalla 14" FHD Táctil 2-en-1',        1499, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',   'Portátiles', 20, 'HP-SPEC360'],
    ['Lenovo ThinkPad X1 Carbon', 'Intel Core i7-1365U, 16GB RAM, 512GB SSD, Pantalla 14" 2.8K OLED',                1799, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&h=300&fit=crop',   'Portátiles', 15, 'LEN-X1C'],
    ['LG Gram 17',                'Intel Core i7-1360P, 32GB RAM, 1TB SSD, Pantalla 17" WQXGA, Peso 1.35kg',         2199, 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&h=300&fit=crop',     'Portátiles', 10, 'LG-GRAM17'],
    ['Samsung Galaxy Book4 Pro',  'Intel Core Ultra 7 155H, 16GB RAM, 512GB SSD, Pantalla 14" AMOLED 120Hz',         1449, 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&h=300&fit=crop',   'Portátiles', 35, 'SAM-GB4P'],
    ['ASUS ROG Strix G16',        'Intel Core i9-13980HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16" FHD 165Hz',        2199, 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=300&fit=crop',   'Gaming', 18, 'ASUS-ROGG16'],
    ['Alienware m18',             'Intel Core i9-13980HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 18" QHD+ 165Hz',       3499, 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=400&h=300&fit=crop',   'Gaming', 8, 'AW-M18'],
    ['MSI Titan GT77',            'Intel Core i9-13900HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 17.3" 4K 144Hz',       3799, 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=300&fit=crop',   'Gaming', 5, 'MSI-GT77'],
    ['Razer Blade 15',            'Intel Core i7-13800H, 16GB RAM, 1TB SSD, NVIDIA RTX 4070, 15.6" QHD 240Hz',       2499, 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&h=300&fit=crop',   'Gaming', 12, 'RAZ-BL15'],
    ['HP Omen 16',                'AMD Ryzen 9 7940HS, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16.1" QHD 165Hz',         1699, 'https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?w=400&h=300&fit=crop',   'Gaming', 22, 'HP-OMEN16'],
    ['Acer Predator Helios 18',   'Intel Core i9-13900HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4080, 18" WQXGA 240Hz',      2699, 'https://images.unsplash.com/photo-1620283085439-39620a119571?w=400&h=300&fit=crop',   'Gaming', 7, 'ACER-PH18'],
    ['Apple iMac 24"',            'Apple M3, 8GB RAM, 256GB SSD, Pantalla 4.5K Retina 24", Cámara 1080p',             1499, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',   'Sobremesa', 20, 'IMAC-24-M3'],
    ['Dell Inspiron 24',          'Intel Core i7-1355U, 16GB RAM, 512GB SSD, Pantalla 23.8" FHD Táctil',             1099, 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=400&h=300&fit=crop',     'Sobremesa', 28, 'DELL-I24'],
    ['HP Pavilion 27',            'AMD Ryzen 7 7735HS, 16GB RAM, 512GB SSD, Pantalla 27" QHD',                       1199, 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=300&fit=crop',   'Sobremesa', 16, 'HP-PAV27'],
  ];
  for (const [nombre, descripcion, precio, imagen, categoria, stock, sku] of data) {
    await pool.query(
      'INSERT INTO productos (nombre, descripcion, precio, imagen, categoria, stock, sku) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [nombre, descripcion, precio, imagen, categoria, stock, sku]
    );
  }
  console.log('Productos de ejemplo insertados');
}

async function seedUsuarios() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
  const cnt = Number.parseInt(result.rows[0].count);

  const adminUser = process.env.ADMIN_USER    ?? 'admin';
  const adminPass = process.env.ADMIN_PASS;
  const stdUser   = process.env.USER_STANDARD ?? 'user';
  const stdPass   = process.env.USER_PASS;

  if (!adminPass || !stdPass) {
    console.error('BLOCKER: ADMIN_PASS and USER_PASS env vars are required');
    process.exit(1);
  }

  if (cnt === 0) {
    await pool.query(
      'INSERT INTO usuarios (username, password, email, role, nombre) VALUES ($1,$2,$3,$4,$5)',
      [adminUser, await argon2.hash(adminPass), 'admin@kratamex.com', 'admin', 'Administrador']
    );
    await pool.query(
      'INSERT INTO usuarios (username, password, email, role, nombre) VALUES ($1,$2,$3,$4,$5)',
      [stdUser, await argon2.hash(stdPass), 'user@kratamex.com', 'standard', 'Usuario Demo']
    );
    console.log('Usuarios creados con argon2id');
  } else {
    const known: Record<string, string> = { [adminUser]: adminPass, [stdUser]: stdPass };
    const { rows: usrs } = await pool.query('SELECT id, username, password FROM usuarios');
    for (const u of usrs) {
      if (!u.password.startsWith('$argon2') && known[u.username]) {
        await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2',
          [await argon2.hash(known[u.username]), u.id]);
        console.log(`Contraseña de ${u.username} migrada a argon2id`);
      }
    }
  }
}

async function seedPedidos() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM pedidos');
  if (Number.parseInt(result.rows[0].count) > 0) return;
  const data = [
    { cliente: 'Juan Pérez',      email: 'juan@email.com',    direccion: 'Calle Mayor 123, Madrid',         total: 2249, daysAgo: 6 },
    { cliente: 'María García',    email: 'maria@email.com',   direccion: 'Av. Roma 45, Barcelona',          total: 1899, daysAgo: 6 },
    { cliente: 'Carlos López',    email: 'carlos@email.com',  direccion: 'Plaza España 10, Valencia',       total: 1499, daysAgo: 5 },
    { cliente: 'Ana Martínez',    email: 'ana@email.com',     direccion: 'Gran Vía 88, Madrid',             total: 3499, daysAgo: 5 },
    { cliente: 'Pedro Sánchez',   email: 'pedro@email.com',   direccion: 'Paseo de Gracia 32, Barcelona',   total: 2199, daysAgo: 4 },
    { cliente: 'Laura Gómez',     email: 'laura@email.com',   direccion: 'Calle Sierpes 7, Sevilla',        total: 1099, daysAgo: 4 },
    { cliente: 'Roberto Díaz',    email: 'roberto@email.com', direccion: 'Av. Constitución 15, Sevilla',    total: 1799, daysAgo: 3 },
    { cliente: 'Elena Fernández', email: 'elena@email.com',   direccion: 'C/ Larios 22, Málaga',            total: 2499, daysAgo: 2 },
    { cliente: 'Miguel Torres',   email: 'miguel@email.com',  direccion: 'Rúa do Vilar 5, Santiago',        total: 1449, daysAgo: 2 },
    { cliente: 'Sofía Ruiz',      email: 'sofia@email.com',   direccion: 'Calle Mayor 55, Zaragoza',        total: 2699, daysAgo: 1 },
    { cliente: 'David Moreno',    email: 'david@email.com',   direccion: 'Paseo Castellana 100, Madrid',    total: 3799, daysAgo: 1 },
    { cliente: 'Carmen Jiménez',  email: 'carmen@email.com',  direccion: 'Av. Diagonal 200, Barcelona',     total: 1199, daysAgo: 0 },
  ];
  for (const p of data) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - p.daysAgo);
    await pool.query(
      "INSERT INTO pedidos (cliente, email, direccion, total, estado, fecha) VALUES ($1,$2,$3,$4,'confirmado',$5)",
      [p.cliente, p.email, p.direccion, p.total, fecha.toISOString()]
    );
  }
  console.log('Pedidos de ejemplo insertados');
}

async function seedCupones() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM cupones');
  if (Number.parseInt(result.rows[0].count) > 0) return;
  await pool.query(`
    INSERT INTO cupones (codigo, tipo, valor, min_compra, max_usos) VALUES
    ('BIENVENIDO10', 'porcentaje', 10, 50, 100),
    ('ENVIOGRATIS',  'fijo', 5.99, 30, 200),
    ('MEGA20',       'porcentaje', 20, 200, 50)
  `);
  console.log('Cupones de ejemplo insertados');
}

async function seedCategorias() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM categorias');
  if (Number.parseInt(result.rows[0].count) > 0) return;
  await pool.query(`
    INSERT INTO categorias (nombre, descripcion, orden) VALUES
    ('Portátiles',  'Portátiles para trabajo y productividad', 1),
    ('Gaming',      'Portátiles y equipos gaming de alto rendimiento', 2),
    ('Sobremesa',   'Ordenadores de sobremesa y All-in-One', 3)
  `);
  console.log('Categorías de ejemplo insertadas');
}

async function waitForDB(maxAttempts = 15, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('PostgreSQL: conexión establecida');
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`PostgreSQL: intento ${i}/${maxAttempts} fallido (${msg}). Reintentando en ${delayMs}ms...`);
      if (i === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// =================================================================
// RUTAS — 2FA
// =================================================================
const TwoFactorSetupSchema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
});

const TwoFactorVerifySchema = z.object({
  code: z.string().length(6, 'El código debe tener 6 dígitos'),
});

app.post('/api/2fa/setup', authenticate, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'No autenticado' }, 401);

    const [dbUser] = await db.select({
      twoFactorEnabled: usuarios.twoFactorEnabled,
      twoFactorSecret: usuarios.twoFactorSecret,
    }).from(usuarios).where(eq(usuarios.id, user.id));

    if (dbUser?.twoFactorEnabled) {
      return c.json({ error: '2FA ya está habilitado' }, 400);
    }

    const secret = generateTwoFactorSecret(user.username);
    const qr = await generateTwoFactorQR(user.username, secret);

    await db.update(usuarios)
      .set({ twoFactorSecret: secret })
      .where(eq(usuarios.id, user.id));

    return c.json({ secret, qr });
  } catch (err) {
    console.error('Error configurando 2FA:', err);
    return c.json({ error: 'Error interno' }, 500);
  }
});

app.post('/api/2fa/enable', authenticate, zValidator('json', TwoFactorSetupSchema), async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'No autenticado' }, 401);

    const [dbUser] = await db.select({
      twoFactorSecret: usuarios.twoFactorSecret,
    }).from(usuarios).where(eq(usuarios.id, user.id));

    if (!dbUser?.twoFactorSecret) {
      return c.json({ error: 'Primero genera el código QR' }, 400);
    }

    const { code } = c.req.valid('json');

    if (!verifyTwoFactorCode(dbUser.twoFactorSecret, code)) {
      logSecEvent('2fa_fail', { ip: getClientIP(c), username: user.username, detalles: 'Código 2FA inválido al habilitar' });
      return c.json({ error: 'Código inválido' }, 400);
    }

    await db.update(usuarios)
      .set({ twoFactorEnabled: true })
      .where(eq(usuarios.id, user.id));

    sessions[c.req.header('authorization')!] = { ...user, twoFactorVerified: true };

    logSecEvent('2fa_enabled', { ip: getClientIP(c), username: user.username });

    return c.json({ success: true });
  } catch (err) {
    console.error('Error habilitando 2FA:', err);
    return c.json({ error: 'Error interno' }, 500);
  }
});

app.post('/api/2fa/disable', authenticate, zValidator('json', TwoFactorSetupSchema), async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'No autenticado' }, 401);

    const { code } = c.req.valid('json');

    const [dbUser] = await db.select({
      twoFactorSecret: usuarios.twoFactorSecret,
      password: usuarios.password,
    }).from(usuarios).where(eq(usuarios.id, user.id));

    if (!dbUser?.twoFactorSecret) {
      return c.json({ error: '2FA no está habilitado' }, 400);
    }

    if (!verifyTwoFactorCode(dbUser.twoFactorSecret, code)) {
      logSecEvent('2fa_fail', { ip: getClientIP(c), username: user.username, detalles: 'Código 2FA inválido al deshabilitar' });
      return c.json({ error: 'Código inválido' }, 400);
    }

    await disableTwoFactor(user.id);

    logSecEvent('2fa_disabled', { ip: getClientIP(c), username: user.username });

    return c.json({ success: true });
  } catch (err) {
    console.error('Error deshabilitando 2FA:', err);
    return c.json({ error: 'Error interno' }, 500);
  }
});

app.post('/api/2fa/verify', authenticate, zValidator('json', TwoFactorVerifySchema), async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'No autenticado' }, 401);

    const { code } = c.req.valid('json');

    const [dbUser] = await db.select({
      twoFactorSecret: usuarios.twoFactorSecret,
    }).from(usuarios).where(eq(usuarios.id, user.id));

    if (!dbUser?.twoFactorSecret) {
      return c.json({ error: '2FA no configurado' }, 400);
    }

    if (!verifyTwoFactorCode(dbUser.twoFactorSecret, code)) {
      logSecEvent('2fa_fail', { ip: getClientIP(c), username: user.username, detalles: 'Código 2FA inválido en login' });
      return c.json({ error: 'Código inválido' }, 400);
    }

    const token = c.req.header('authorization')!;
    sessions[token] = { ...user, twoFactorVerified: true };

    logSecEvent('2fa_success', { ip: getClientIP(c), username: user.username });

    return c.json({ success: true });
  } catch (err) {
    console.error('Error verificando 2FA:', err);
    return c.json({ error: 'Error interno' }, 500);
  }
});

app.get('/api/2fa/status', authenticate, async (c) => {
  try {
    const user = c.get('user');
    if (!user) return c.json({ error: 'No autenticado' }, 401);

    const [dbUser] = await db.select({
      twoFactorEnabled: usuarios.twoFactorEnabled,
    }).from(usuarios).where(eq(usuarios.id, user.id));

    return c.json({ enabled: dbUser?.twoFactorEnabled || false });
  } catch (err) {
    console.error('Error obteniendo estado 2FA:', err);
    return c.json({ error: 'Error interno' }, 500);
  }
});

// =================================================================
// CHATBOT
// =================================================================
app.post('/api/chat', generalRateLimiter, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const raw = (body.message || '').toString().slice(0, 300);
    const msg = raw.toLowerCase().trim();

    if (!msg) return c.json({ reply: 'Por favor escribe tu pregunta.' });

    // Buscar producto por nombre
    if (
      msg.includes('busco') || msg.includes('tienes') ||
      msg.includes('venden') || msg.includes('hay ')
    ) {
      const keywords = raw.replace(/busco|tienes|venden|hay/gi, '').trim();
      if (keywords.length > 1) {
        const results = await db
          .select({ id: productos.id, nombre: productos.nombre, precio: productos.precio })
          .from(productos)
          .where(sql`lower(${productos.nombre}) like ${'%' + keywords.toLowerCase() + '%'}`)
          .limit(3);
        if (results.length > 0) {
          const lista = results.map(p => `• ${p.nombre} — €${p.precio}`).join('\n');
          return c.json({ reply: `Encontré estos productos:\n${lista}\n\nPuedes verlos en el catálogo.` });
        }
        return c.json({ reply: `No encontré productos con "${keywords}". Prueba otros términos o revisa el catálogo completo.` });
      }
    }

    // Envíos
    if (msg.includes('envío') || msg.includes('envio') || msg.includes('entrega') || msg.includes('shipping')) {
      return c.json({ reply: 'Ofrecemos envío estándar por €5,99. ¡Envío gratis en pedidos superiores a €100! El plazo habitual es de 2-4 días hábiles.' });
    }

    // Plazo / tiempo
    if (msg.includes('tarda') || msg.includes('plazo') || msg.includes('tiempo') || msg.includes('cuándo') || msg.includes('cuando')) {
      return c.json({ reply: 'Los pedidos suelen llegar en 2-4 días hábiles. Recibirás un email con el número de seguimiento una vez despachado.' });
    }

    // Devoluciones
    if (msg.includes('devol') || msg.includes('cambio') || msg.includes('reembolso') || msg.includes('garantía') || msg.includes('garantia')) {
      return c.json({ reply: 'Aceptamos devoluciones hasta 14 días desde la entrega. El producto debe estar sin usar y en su embalaje original. Escríbenos a soporte@kratamex.com para gestionar la devolución.' });
    }

    // Pago
    if (msg.includes('pago') || msg.includes('pagar') || msg.includes('tarjeta') || msg.includes('stripe') || msg.includes('método') || msg.includes('metodo')) {
      return c.json({ reply: 'Aceptamos tarjetas Visa, Mastercard y American Express a través de Stripe (pago 100% seguro). También puedes usar cupones de descuento.' });
    }

    // Cupón
    if (msg.includes('cupón') || msg.includes('cupon') || msg.includes('descuento') || msg.includes('código') || msg.includes('codigo')) {
      return c.json({ reply: 'Puedes introducir tu código de descuento en el carrito antes de finalizar la compra. Los cupones no son acumulables entre sí.' });
    }

    // Contacto
    if (msg.includes('contacto') || msg.includes('contactar') || msg.includes('email') || msg.includes('ayuda') || msg.includes('soporte')) {
      return c.json({ reply: 'Puedes contactarnos en soporte@kratamex.com o a través de este chat. Atendemos de lunes a viernes de 9:00 a 18:00.' });
    }

    // Cuenta / registro
    if (msg.includes('cuenta') || msg.includes('registro') || msg.includes('registrar') || msg.includes('contraseña') || msg.includes('password')) {
      return c.json({ reply: 'Para crear una cuenta haz clic en "Entrar" → "Crear cuenta". Si olvidaste tu contraseña, usa la opción "¿Olvidaste tu contraseña?" en el login.' });
    }

    // Pedido
    if (msg.includes('pedido') || msg.includes('orden') || msg.includes('compra')) {
      return c.json({ reply: 'Puedes ver el estado de tus pedidos en "Mis pedidos" (necesitas estar logueado). Si tienes algún problema con un pedido, contáctanos en soporte@kratamex.com.' });
    }

    // Saludo
    if (msg.includes('hola') || msg.includes('buenas') || msg.includes('hey') || msg === 'hi') {
      return c.json({ reply: '¡Hola! ¿En qué puedo ayudarte? Puedo informarte sobre envíos, devoluciones, pagos, productos y más.' });
    }

    // Gracias
    if (msg.includes('gracias') || msg.includes('perfecto') || msg.includes('genial') || msg.includes('ok')) {
      return c.json({ reply: '¡De nada! Si necesitas algo más, aquí estoy. ¡Que disfrutes tu compra!' });
    }

    // Fallback
    return c.json({ reply: 'No estoy seguro de cómo ayudarte con eso. Puedes preguntarme sobre envíos, devoluciones, pagos o productos. También puedes escribirnos a soporte@kratamex.com.' });
  } catch {
    return c.json({ reply: 'Error interno. Por favor intenta de nuevo.' }, 500);
  }
});

export { app };

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await waitForDB();
      await ensureClientDatabaseExists();
      await waitForClientDB();
      await ensureSocDatabaseExists();
      await waitForSocDB();
      await initDB();
      await initClientDB();
      await initSocDB();
      await seedProductos();
      await seedUsuarios();
      await seedClientUsers();
      await seedPedidos();
      await seedCupones();
      await seedCategorias();
      await seedSocAdmins();
      serve({ fetch: app.fetch, port: PORT }, () =>
        console.log(`Backend Hono v3 corriendo en http://localhost:${PORT}`)
      );
    } catch (err) {
      console.error('Error al iniciar el backend:', err);
      process.exit(1);
    }
  })();
}
