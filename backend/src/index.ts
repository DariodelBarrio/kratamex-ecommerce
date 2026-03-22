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
import Stripe from 'stripe';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { eq, and, or, ilike, gte, lte, asc, desc, sql, count, avg } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import argon2 from 'argon2';
import { v2 as cloudinary } from 'cloudinary';

import { db, pool } from './db/index';
import {
  productos, pedidos, pedidoItems, usuarios, comentarios,
  categorias, valoraciones, favoritos, cupones, productoImagenes,
  pushSubscriptions, securityEvents,
} from './db/schema';
import {
  ProductoBodySchema, ProductosQuerySchema, LoginSchema, RegisterSchema,
  PedidoSchema, PedidoEstadoSchema, ComentarioSchema, ValoracionSchema,
  CategoriaSchema, CuponSchema, ValidarCuponSchema, PushSubscriptionSchema,
  PerfilSchema, CambiarPasswordSchema,
} from './schemas';

const PORT = 3001;
const IVA_RATE = 0.21;
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
        (err, result) => (err ? reject(err) : resolve(result!.secure_url))
      )
      .end(buffer);
  });
}

// =================================================================
// SEGURIDAD
// =================================================================
function sanitizeText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
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
};

const sessions: Record<string, SessionData> = {};
const SESSION_TTL = 8 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [token, session] of Object.entries(sessions)) {
    if (now - session.createdAt > SESSION_TTL) delete sessions[token];
  }
}, 15 * 60 * 1000);

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

setInterval(() => {
  const now = Date.now();
  for (const ip of Object.keys(loginAttempts)) {
    const rec = loginAttempts[ip];
    if (rec.blockedUntil && now > rec.blockedUntil + 300_000) delete loginAttempts[ip];
    else if (!rec.blockedUntil && now - (rec.lastAttempt || 0) > 300_000) delete loginAttempts[ip];
  }
  for (const ip of Object.keys(checkoutAttempts)) {
    if (now - checkoutAttempts[ip].windowStart > CHECKOUT_WINDOW * 5) delete checkoutAttempts[ip];
  }
  for (const ip of Object.keys(generalAttempts)) {
    if (now - generalAttempts[ip].windowStart > GENERAL_WINDOW * 5) delete generalAttempts[ip];
  }
  for (const ip of Object.keys(comentariosAttempts)) {
    if (now - comentariosAttempts[ip].windowStart > 60_000 * 5) delete comentariosAttempts[ip];
  }
}, 5 * 60 * 1000);

// =================================================================
// HONO APP
// =================================================================
type Variables = { user: SessionData };
const app = new Hono<{ Variables: Variables }>();

function getClientIP(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return c.req.header('x-real-ip') || 'unknown';
}

// --- Security headers ---
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-XSS-Protection', '0');
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.res.headers.delete('X-Powered-By');
});

// --- CORS ---
const ALLOWED_ORIGINS = [
  process.env.CORS_ORIGIN || 'https://localhost',
  'http://localhost:3000',
];
app.use('*', cors({
  origin: (origin) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return origin || '*';
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
  c.set('user', session);
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

const requireAdmin: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  if (c.get('user')?.role !== 'admin')
    return c.json({ error: 'Acceso denegado. Se requiere rol de administrador' }, 403);
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
// SECURITY EVENT LOGGER
// =================================================================
async function logSecEvent(tipo: string, data: {
  ip?: string; username?: string; endpoint?: string;
  metodo?: string; userAgent?: string; detalles?: string;
}) {
  try {
    await db.insert(securityEvents).values({ tipo, ...data });
  } catch {}
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
    // Ocultar productos marcados como inactivos
    conditions.push(sql`${productos.activo} = true`);

    const orderBy = orden === 'asc'    ? asc(productos.precio)
                  : orden === 'desc'   ? desc(productos.precio)
                  : orden === 'nuevo'  ? desc(productos.fecha)
                  : asc(productos.id);

    const rows = await db.select().from(productos)
      .where(conditions.length ? and(...conditions as Parameters<typeof and>) : undefined)
      .orderBy(orderBy)
      .limit(qLimit || 100)
      .offset(qOffset || 0);

    // Attach average ratings
    const productIds = rows.map(r => r.id);
    let ratingsMap: Record<number, { avg: number; count: number }> = {};
    if (productIds.length > 0) {
      const ratingsResult = await db.select({
        productoId: valoraciones.productoId,
        avg: avg(valoraciones.puntuacion),
        count: count(),
      }).from(valoraciones)
        .where(sql`${valoraciones.productoId} IN (${sql.join(productIds.map(id => sql`${id}`), sql`,`)})`)
        .groupBy(valoraciones.productoId);
      for (const r of ratingsResult) {
        ratingsMap[r.productoId] = { avg: parseFloat(r.avg as string) || 0, count: Number(r.count) };
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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [producto] = await db.select().from(productos).where(eq(productos.id, id));
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
      rating: parseFloat(ratingData?.avg as string) || 0,
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
    return c.json({ id: row.id, mensaje: 'Producto creado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.put('/api/productos/:id', authenticate, requireAdmin, zValidator('json', ProductoBodySchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    return c.json({ mensaje: 'Producto actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/productos/:id/imagen', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    const imgId = parseInt(c.req.param('imgId'));
    if (isNaN(imgId)) return c.json({ error: 'ID inválido' }, 400);
    await db.delete(productoImagenes).where(eq(productoImagenes.id, imgId));
    return c.json({ mensaje: 'Imagen eliminada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.patch('/api/productos/:id/stock', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const body = await c.req.json();
    const updateData: Record<string, unknown> = {};
    if (body.stock !== undefined) updateData.stock = Math.max(0, parseInt(body.stock) || 0);
    if (body.activo !== undefined) updateData.activo = Boolean(body.activo);
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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.delete(productos).where(eq(productos.id, id)).returning({ id: productos.id });
    if (!result.length) return c.json({ error: 'Producto no encontrado' }, 404);
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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    const productoId = parseInt(c.req.param('id'));
    if (isNaN(productoId)) return c.json({ error: 'ID inválido' }, 400);

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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
// RUTAS — PEDIDOS
// =================================================================
app.post('/api/pedidos', checkoutRateLimiter, optionalAuth, zValidator('json', PedidoSchema), async (c) => {
  const { cliente, email, direccion, items, cupon } = c.req.valid('json');
  const user = c.get('user');

  try {
    const result = await db.transaction(async (tx) => {
      let subtotal = 0;
      const itemsValidados: { id: number; precio: number; cantidad: number }[] = [];

      for (const item of items) {
        const [prod] = await tx.select({ id: productos.id, precio: productos.precio, stock: productos.stock, nombre: productos.nombre })
          .from(productos)
          .where(eq(productos.id, item.id));
        if (!prod) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { status: 400 });
        if (prod.stock < item.cantidad) throw Object.assign(new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}`), { status: 400, code: 'INSUFFICIENT_STOCK' });

        subtotal += prod.precio * item.cantidad;
        itemsValidados.push({ id: prod.id, precio: prod.precio, cantidad: item.cantidad });
      }

      // Apply coupon
      let descuento = 0;
      let cuponId: number | null = null;
      if (cupon) {
        const [cup] = await tx.select().from(cupones).where(eq(cupones.codigo, cupon.toUpperCase()));
        if (cup && cup.activo) {
          const now = new Date();
          const validDate = (!cup.fechaInicio || new Date(cup.fechaInicio) <= now) &&
                           (!cup.fechaFin || new Date(cup.fechaFin) >= now);
          const validUsos = !cup.maxUsos || (cup.usosActuales ?? 0) < cup.maxUsos;
          const validMin = subtotal >= (cup.minCompra ?? 0);
          if (validDate && validUsos && validMin) {
            descuento = cup.tipo === 'porcentaje'
              ? Math.round(subtotal * (cup.valor / 100) * 100) / 100
              : Math.min(cup.valor, subtotal);
            cuponId = cup.id;
            await tx.update(cupones).set({ usosActuales: (cup.usosActuales ?? 0) + 1 }).where(eq(cupones.id, cup.id));
          }
        }
      }

      const subtotalConDescuento = subtotal - descuento;
      const impuestos = calcularImpuestos(subtotalConDescuento);
      const envio = calcularEnvio(subtotalConDescuento);
      const total = Math.round((subtotalConDescuento + impuestos + envio) * 100) / 100;

      const [newPedido] = await tx.insert(pedidos).values({
        usuarioId:  user?.id ?? null,
        cliente:    sanitizeText(cliente),
        email,
        direccion:  sanitizeText(direccion),
        subtotal:   subtotalConDescuento,
        impuestos,
        envio,
        descuento,
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
        // Decrease stock
        await tx.update(productos).set({
          stock: sql`${productos.stock} - ${item.cantidad}`,
        }).where(eq(productos.id, item.id));
      }

      return { id: newPedido.id, total, subtotal: subtotalConDescuento, impuestos, envio, descuento };
    });

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

    const result = [];
    for (const pedido of rows) {
      const items = await db.select({
        id:         pedidoItems.id,
        productoId: pedidoItems.productoId,
        cantidad:   pedidoItems.cantidad,
        precio:     pedidoItems.precio,
        nombre:     productos.nombre,
        imagen:     productos.imagen,
      }).from(pedidoItems)
        .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
        .where(eq(pedidoItems.pedidoId, pedido.id));
      result.push({ ...pedido, items });
    }
    return c.json(result);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// Admin — list orders
app.get('/api/pedidos', authenticate, requireAdmin, async (c) => {
  try {
    const limit  = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

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
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const { estado, notas } = c.req.valid('json');
    const updateData: Record<string, unknown> = { estado };
    if (notas !== undefined) updateData.notas = sanitizeText(notas);

    const result = await db.update(pedidos).set(updateData).where(eq(pedidos.id, id)).returning({ id: pedidos.id });
    if (!result.length) return c.json({ error: 'Pedido no encontrado' }, 404);
    return c.json({ mensaje: 'Estado actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.get('/api/admin/pedidos', authenticate, requireAdmin, async (c) => {
  try {
    const limit  = Math.min(parseInt(c.req.query('limit') || '100'), 500);
    const offset = Math.max(parseInt(c.req.query('offset') || '0'), 0);
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

app.delete('/api/admin/pedidos/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const result = await db.delete(pedidos).where(eq(pedidos.id, id)).returning({ id: pedidos.id });
    if (!result.length) return c.json({ error: 'Pedido no encontrado' }, 404);
    return c.json({ mensaje: 'Pedido eliminado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — CSV EXPORT
// =================================================================
app.get('/api/admin/pedidos/csv', authenticate, requireAdmin, async (c) => {
  try {
    const rows = await db.select().from(pedidos).orderBy(desc(pedidos.fecha));
    let csv = 'ID,Cliente,Email,Dirección,Subtotal,Impuestos,Envío,Descuento,Total,Estado,Fecha\n';
    for (const p of rows) {
      csv += `${p.id},"${p.cliente}","${p.email}","${p.direccion}",${p.subtotal ?? ''},${p.impuestos ?? ''},${p.envio ?? ''},${p.descuento ?? 0},${p.total},"${p.estado}","${p.fecha}"\n`;
    }
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="pedidos.csv"');
    return c.body(csv);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error al exportar' }, 500);
  }
});

app.get('/api/admin/productos/csv', authenticate, requireAdmin, async (c) => {
  try {
    const rows = await db.select().from(productos).orderBy(asc(productos.id));
    let csv = 'ID,Nombre,Categoría,Precio,Stock,SKU,Destacado,Activo\n';
    for (const p of rows) {
      csv += `${p.id},"${p.nombre}","${p.categoria}",${p.precio},${p.stock},"${p.sku || ''}",${p.destacado},${p.activo}\n`;
    }
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="productos.csv"');
    return c.body(csv);
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
    return c.json({ id: row.id, mensaje: 'Categoría creada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.put('/api/categorias/:id', authenticate, requireAdmin, zValidator('json', CategoriaSchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    const data = c.req.valid('json');
    const result = await db.update(categorias).set({
      nombre:      sanitizeText(data.nombre),
      descripcion: sanitizeText(data.descripcion || ''),
      imagen:      data.imagen || '',
      orden:       data.orden ?? 0,
      activa:      data.activa ?? true,
    }).where(eq(categorias.id, id)).returning({ id: categorias.id });
    if (!result.length) return c.json({ error: 'Categoría no encontrada' }, 404);
    return c.json({ mensaje: 'Categoría actualizada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/categorias/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    await db.delete(categorias).where(eq(categorias.id, id));
    return c.json({ mensaje: 'Categoría eliminada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — CUPONES
// =================================================================
app.get('/api/admin/cupones', authenticate, requireAdmin, async (c) => {
  try {
    const rows = await db.select().from(cupones).orderBy(desc(cupones.createdAt));
    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/admin/cupones', authenticate, requireAdmin, zValidator('json', CuponSchema), async (c) => {
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
    return c.json({ id: row.id, mensaje: 'Cupón creado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.delete('/api/admin/cupones/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
    await db.delete(cupones).where(eq(cupones.id, id));
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
    if (!cup || !cup.activo) return c.json({ error: 'Cupón no válido' }, 404);

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
    const productoId = parseInt(c.req.param('productoId'));
    if (isNaN(productoId)) return c.json({ error: 'ID inválido' }, 400);

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
    const productoId = parseInt(c.req.param('productoId'));
    if (isNaN(productoId)) return c.json({ error: 'ID inválido' }, 400);

    await db.delete(favoritos).where(and(eq(favoritos.usuarioId, user.id), eq(favoritos.productoId, productoId)));
    return c.json({ mensaje: 'Eliminado de favoritos' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — AUTH
// =================================================================
app.post('/api/register', loginRateLimiter, zValidator('json', RegisterSchema), async (c) => {
  const { username, password, email, nombre } = c.req.valid('json');
  try {
    const [existing] = await db.select({ id: usuarios.id }).from(usuarios)
      .where(or(eq(usuarios.username, username), eq(usuarios.email, email)));
    if (existing) return c.json({ error: 'El usuario o email ya existe' }, 409);

    const hashedPassword = await argon2.hash(password);
    const [user] = await db.insert(usuarios).values({
      username: sanitizeText(username),
      password: hashedPassword,
      email,
      nombre:  nombre ? sanitizeText(nombre) : null,
      role:    'standard',
    }).returning({ id: usuarios.id, username: usuarios.username, role: usuarios.role });

    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { id: user.id, username: user.username, role: user.role ?? 'standard', avatar: null, createdAt: Date.now() };

    return c.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role },
      message: 'Cuenta creada correctamente',
    }, 201);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/login', loginRateLimiter, zValidator('json', LoginSchema), async (c) => {
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
    }
  }

  try {
    const [user] = await db.select().from(usuarios).where(eq(usuarios.username, username));
    let passwordValida = false;
    if (user) {
      try { passwordValida = await argon2.verify(user.password, password); }
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
      user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar, nombre: user.nombre, email: user.email },
      message: 'Inicio de sesión correcto',
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

app.post('/api/logout', (c) => {
  const token = c.req.header('authorization');
  if (token && sessions[token]) delete sessions[token];
  return c.json({ message: 'Sesión cerrada' });
});

app.get('/api/usuario', authenticate, (c) => {
  return c.json({ user: c.get('user') });
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

    const token = c.req.header('authorization')!;
    if (sessions[token]) sessions[token].avatar = avatarUrl;

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
    const [row] = await db.select().from(usuarios).where(eq(usuarios.id, user.id));
    if (!row) return c.json({ error: 'Usuario no encontrado' }, 404);
    const valida = await argon2.verify(row.password, passwordActual);
    if (!valida) return c.json({ error: 'Contraseña actual incorrecta' }, 400);
    const hash = await argon2.hash(passwordNueva);
    await db.update(usuarios).set({ password: hash }).where(eq(usuarios.id, user.id));
    return c.json({ mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — ADMIN USERS
// =================================================================
app.get('/api/admin/usuarios', authenticate, requireAdmin, async (c) => {
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
app.get('/api/security/events', authenticate, requireAdmin, async (c) => {
  try {
    const limit = Math.min(Number(c.req.query('limit') || 100), 500);
    const tipo  = c.req.query('tipo');
    const rows  = await db.select().from(securityEvents)
      .where(tipo ? eq(securityEvents.tipo, tipo) : undefined)
      .orderBy(desc(securityEvents.fecha))
      .limit(limit);
    return c.json(rows);
  } catch (err) { console.error(err); return c.json({ error: 'Error' }, 500); }
});

app.get('/api/security/stats', authenticate, requireAdmin, async (c) => {
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
    const activeSessions = Object.keys(sessions).filter(t => Date.now() - sessions[t].createdAt < SESSION_TTL).length;

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
});

// =================================================================
// RUTAS — ADMIN VALORACIONES (reseñas)
// =================================================================
app.get('/api/admin/valoraciones', authenticate, requireAdmin, async (c) => {
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

app.delete('/api/admin/valoraciones/:id', authenticate, requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);
  try {
    await db.delete(valoraciones).where(eq(valoraciones.id, id));
    return c.json({ ok: true });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — ADMIN ANALYTICS
// =================================================================
app.get('/api/admin/analytics', authenticate, requireAdmin, async (c) => {
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
    const result = await db.transaction(async (tx) => {
      let subtotal = 0;
      const itemsValidados: { id: number; precio: number; cantidad: number }[] = [];

      for (const item of items) {
        const [prod] = await tx.select({ id: productos.id, precio: productos.precio, stock: productos.stock, nombre: productos.nombre })
          .from(productos)
          .where(eq(productos.id, item.id));
        if (!prod) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { status: 400 });
        if (prod.stock < item.cantidad) throw Object.assign(new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${prod.stock}`), { status: 400, code: 'INSUFFICIENT_STOCK' });

        subtotal += prod.precio * item.cantidad;
        itemsValidados.push({ id: prod.id, precio: prod.precio, cantidad: item.cantidad });
      }

      let descuento = 0;
      let cuponId: number | null = null;
      if (cupon) {
        const [cup] = await tx.select().from(cupones).where(eq(cupones.codigo, cupon.toUpperCase()));
        if (cup && cup.activo) {
          const now = new Date();
          const validDate = (!cup.fechaInicio || new Date(cup.fechaInicio) <= now) &&
                           (!cup.fechaFin || new Date(cup.fechaFin) >= now);
          const validUsos = !cup.maxUsos || (cup.usosActuales ?? 0) < cup.maxUsos;
          const validMin = subtotal >= (cup.minCompra ?? 0);
          if (validDate && validUsos && validMin) {
            descuento = cup.tipo === 'porcentaje'
              ? Math.round(subtotal * (cup.valor / 100) * 100) / 100
              : Math.min(cup.valor, subtotal);
            cuponId = cup.id;
            await tx.update(cupones).set({ usosActuales: (cup.usosActuales ?? 0) + 1 }).where(eq(cupones.id, cup.id));
          }
        }
      }

      const subtotalConDescuento = subtotal - descuento;
      const impuestos = calcularImpuestos(subtotalConDescuento);
      const envio = calcularEnvio(subtotalConDescuento);
      const total = Math.round((subtotalConDescuento + impuestos + envio) * 100) / 100;

      const [newPedido] = await tx.insert(pedidos).values({
        usuarioId:  user?.id ?? null,
        cliente:    sanitizeText(cliente),
        email,
        direccion:  sanitizeText(direccion),
        subtotal:   subtotalConDescuento,
        impuestos,
        envio,
        descuento,
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

      return { id: newPedido.id, total };
    });

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
    // Sin secret configurado: aceptar en dev sin verificar firma
    console.warn('[webhook] STRIPE_WEBHOOK_SECRET no configurado — saltando verificación');
    return c.json({ received: true });
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
    const pedidoId = parseInt(pi.metadata?.pedidoId || '');
    if (!isNaN(pedidoId)) {
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
  const subtotal = parseFloat(c.req.query('subtotal') || '0');
  const envio = calcularEnvio(subtotal);
  const impuestos = calcularImpuestos(subtotal);
  const total = Math.round((subtotal + impuestos + envio) * 100) / 100;
  return c.json({ subtotal, envio, impuestos, total, envioGratisMinimo: ENVIO_GRATIS_MINIMO, ivaRate: IVA_RATE });
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
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT    NOT NULL UNIQUE,
      descripcion TEXT,
      imagen      TEXT,
      orden       INTEGER DEFAULT 0,
      activa      BOOLEAN DEFAULT TRUE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS productos (
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
    );
    CREATE TABLE IF NOT EXISTS producto_imagenes (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      url         TEXT NOT NULL,
      orden       INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pedidos (
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
    );
    CREATE TABLE IF NOT EXISTS pedido_items (
      id          SERIAL  PRIMARY KEY,
      pedido_id   INTEGER NOT NULL REFERENCES pedidos(id)   ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
      cantidad    INTEGER NOT NULL,
      precio      REAL    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usuarios (
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
    );
    CREATE TABLE IF NOT EXISTS comentarios (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      autor       TEXT    NOT NULL,
      contenido   TEXT    NOT NULL,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS valoraciones (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      puntuacion  INTEGER NOT NULL CHECK(puntuacion BETWEEN 1 AND 5),
      titulo      TEXT,
      comentario  TEXT,
      fecha       TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(producto_id, usuario_id)
    );
    CREATE TABLE IF NOT EXISTS favoritos (
      id          SERIAL PRIMARY KEY,
      usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(usuario_id, producto_id)
    );
    CREATE TABLE IF NOT EXISTS cupones (
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
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          SERIAL PRIMARY KEY,
      usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
      endpoint    TEXT NOT NULL UNIQUE,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS security_events (
      id          SERIAL PRIMARY KEY,
      tipo        TEXT NOT NULL,
      ip          TEXT,
      username    TEXT,
      endpoint    TEXT,
      metodo      TEXT,
      user_agent  TEXT,
      detalles    TEXT,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    );
  `);

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
  ];
  for (const q of alterQueries) {
    try { await pool.query(q); } catch {}
  }

  // Set default stock for existing products
  await pool.query(`UPDATE productos SET stock = 50 WHERE stock = 0 OR stock IS NULL`);

  console.log('PostgreSQL: tablas verificadas');
}

async function seedProductos() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM productos');
  if (parseInt(result.rows[0].count) > 0) return;
  const data = [
    ['MacBook Pro 14"',           'Apple M3 Pro, 18GB RAM, 512GB SSD, Pantalla Liquid Retina XDR',                    2249.00, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',   'Portátiles', 25, 'MBP-14-M3'],
    ['Dell XPS 15',               'Intel Core i7-13700H, 32GB RAM, 1TB SSD, NVIDIA RTX 4060, 15.6" 3.5K OLED',       1899.00, 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&h=300&fit=crop',   'Portátiles', 30, 'DELL-XPS15'],
    ['HP Spectre x360',           'Intel Core i7-1255U, 16GB RAM, 512GB SSD, Pantalla 14" FHD Táctil 2-en-1',        1499.00, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',   'Portátiles', 20, 'HP-SPEC360'],
    ['Lenovo ThinkPad X1 Carbon', 'Intel Core i7-1365U, 16GB RAM, 512GB SSD, Pantalla 14" 2.8K OLED',                1799.00, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&h=300&fit=crop',   'Portátiles', 15, 'LEN-X1C'],
    ['LG Gram 17',                'Intel Core i7-1360P, 32GB RAM, 1TB SSD, Pantalla 17" WQXGA, Peso 1.35kg',         2199.00, 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&h=300&fit=crop',     'Portátiles', 10, 'LG-GRAM17'],
    ['Samsung Galaxy Book4 Pro',  'Intel Core Ultra 7 155H, 16GB RAM, 512GB SSD, Pantalla 14" AMOLED 120Hz',         1449.00, 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&h=300&fit=crop',   'Portátiles', 35, 'SAM-GB4P'],
    ['ASUS ROG Strix G16',        'Intel Core i9-13980HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16" FHD 165Hz',        2199.00, 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=300&fit=crop',   'Gaming', 18, 'ASUS-ROGG16'],
    ['Alienware m18',             'Intel Core i9-13980HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 18" QHD+ 165Hz',       3499.00, 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=400&h=300&fit=crop',   'Gaming', 8, 'AW-M18'],
    ['MSI Titan GT77',            'Intel Core i9-13900HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 17.3" 4K 144Hz',       3799.00, 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=300&fit=crop',   'Gaming', 5, 'MSI-GT77'],
    ['Razer Blade 15',            'Intel Core i7-13800H, 16GB RAM, 1TB SSD, NVIDIA RTX 4070, 15.6" QHD 240Hz',       2499.00, 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&h=300&fit=crop',   'Gaming', 12, 'RAZ-BL15'],
    ['HP Omen 16',                'AMD Ryzen 9 7940HS, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16.1" QHD 165Hz',         1699.00, 'https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?w=400&h=300&fit=crop',   'Gaming', 22, 'HP-OMEN16'],
    ['Acer Predator Helios 18',   'Intel Core i9-13900HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4080, 18" WQXGA 240Hz',      2699.00, 'https://images.unsplash.com/photo-1620283085439-39620a119571?w=400&h=300&fit=crop',   'Gaming', 7, 'ACER-PH18'],
    ['Apple iMac 24"',            'Apple M3, 8GB RAM, 256GB SSD, Pantalla 4.5K Retina 24", Cámara 1080p',             1499.00, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',   'Sobremesa', 20, 'IMAC-24-M3'],
    ['Dell Inspiron 24',          'Intel Core i7-1355U, 16GB RAM, 512GB SSD, Pantalla 23.8" FHD Táctil',             1099.00, 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=400&h=300&fit=crop',     'Sobremesa', 28, 'DELL-I24'],
    ['HP Pavilion 27',            'AMD Ryzen 7 7735HS, 16GB RAM, 512GB SSD, Pantalla 27" QHD',                       1199.00, 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=300&fit=crop',   'Sobremesa', 16, 'HP-PAV27'],
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
  const cnt = parseInt(result.rows[0].count);

  const adminUser = process.env.ADMIN_USER    || 'admin';
  const adminPass = process.env.ADMIN_PASS    || 'admin123';
  const stdUser   = process.env.USER_STANDARD || 'user';
  const stdPass   = process.env.USER_PASS     || 'user123';

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
  if (parseInt(result.rows[0].count) > 0) return;
  const data = [
    { cliente: 'Juan Pérez',      email: 'juan@email.com',    direccion: 'Calle Mayor 123, Madrid',         total: 2249.00, daysAgo: 6 },
    { cliente: 'María García',    email: 'maria@email.com',   direccion: 'Av. Roma 45, Barcelona',          total: 1899.00, daysAgo: 6 },
    { cliente: 'Carlos López',    email: 'carlos@email.com',  direccion: 'Plaza España 10, Valencia',       total: 1499.00, daysAgo: 5 },
    { cliente: 'Ana Martínez',    email: 'ana@email.com',     direccion: 'Gran Vía 88, Madrid',             total: 3499.00, daysAgo: 5 },
    { cliente: 'Pedro Sánchez',   email: 'pedro@email.com',   direccion: 'Paseo de Gracia 32, Barcelona',   total: 2199.00, daysAgo: 4 },
    { cliente: 'Laura Gómez',     email: 'laura@email.com',   direccion: 'Calle Sierpes 7, Sevilla',        total: 1099.00, daysAgo: 4 },
    { cliente: 'Roberto Díaz',    email: 'roberto@email.com', direccion: 'Av. Constitución 15, Sevilla',    total: 1799.00, daysAgo: 3 },
    { cliente: 'Elena Fernández', email: 'elena@email.com',   direccion: 'C/ Larios 22, Málaga',            total: 2499.00, daysAgo: 2 },
    { cliente: 'Miguel Torres',   email: 'miguel@email.com',  direccion: 'Rúa do Vilar 5, Santiago',        total: 1449.00, daysAgo: 2 },
    { cliente: 'Sofía Ruiz',      email: 'sofia@email.com',   direccion: 'Calle Mayor 55, Zaragoza',        total: 2699.00, daysAgo: 1 },
    { cliente: 'David Moreno',    email: 'david@email.com',   direccion: 'Paseo Castellana 100, Madrid',    total: 3799.00, daysAgo: 1 },
    { cliente: 'Carmen Jiménez',  email: 'carmen@email.com',  direccion: 'Av. Diagonal 200, Barcelona',     total: 1199.00, daysAgo: 0 },
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
  if (parseInt(result.rows[0].count) > 0) return;
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
  if (parseInt(result.rows[0].count) > 0) return;
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

(async () => {
  try {
    await waitForDB();
    await initDB();
    await seedProductos();
    await seedUsuarios();
    await seedPedidos();
    await seedCupones();
    await seedCategorias();
    serve({ fetch: app.fetch, port: PORT }, () =>
      console.log(`Backend Hono v3 corriendo en http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error('Error al iniciar el backend:', err);
    process.exit(1);
  }
})();
