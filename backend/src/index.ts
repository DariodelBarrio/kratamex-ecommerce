/*
=================================================================
KRATAMEX — BACKEND v2 (Hono + Drizzle ORM + Zod)
=================================================================
Runtime:    Node.js via @hono/node-server
Framework:  Hono (ultra-ligero, tipo-seguro, compatible con Edge)
ORM:        Drizzle ORM (SQL con tipos TypeScript)
Validación: Zod + @hono/zod-validator
Imágenes:   Cloudinary (avatares) con fallback local
=================================================================
*/

import 'dotenv/config';
import { Hono, type Context, type MiddlewareHandler, type Next } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { eq, and, or, ilike, gte, lte, asc, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import argon2 from 'argon2';
import { v2 as cloudinary } from 'cloudinary';

import { db, pool } from './db/index';
import { productos, pedidos, pedidoItems, usuarios, comentarios } from './db/schema';
import {
  ProductoBodySchema,
  ProductosQuerySchema,
  LoginSchema,
  PedidoSchema,
  ComentarioSchema,
} from './schemas';

const PORT = 3001;

// =================================================================
// CLOUDINARY — configurar si hay credenciales
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
        { folder, resource_type: 'image', transformation: [{ width: 400, height: 400, crop: 'fill' }] },
        (err, result) => (err ? reject(err) : resolve(result!.secure_url))
      )
      .end(buffer);
  });
}

// =================================================================
// SEGURIDAD — Sanitización de texto (anti-XSS)
// =================================================================
function sanitizeText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// =================================================================
// SEGURIDAD — Validación de tipo de archivo
// =================================================================
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
// SESIONES (con TTL)
// =================================================================
type SessionData = {
  id: number;
  username: string;
  role: string;
  avatar: string | null;
  createdAt: number;
};

const sessions: Record<string, SessionData> = {};
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 horas

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

const generalAttempts:  Record<string, RateLimitRecord> = {};
const loginAttempts:    Record<string, LoginRecord>     = {};
const checkoutAttempts: Record<string, RateLimitRecord> = {};
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

// --- IP helper ---
function getClientIP(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp;
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

// --- Static files (backward compat con archivos ya subidos) ---
app.use('/uploads/*', serveStatic({ root: './src' }));
app.use('/avatars/*',  serveStatic({ root: './src' }));

// =================================================================
// MIDDLEWARE — Rate limiters
// =================================================================
const generalRateLimiter: MiddlewareHandler = async (c, next) => {
  const ip  = getClientIP(c);
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
  const ip  = getClientIP(c);
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
  const ip  = getClientIP(c);
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
  const ip  = getClientIP(c);
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
// MIDDLEWARE — Autenticación + RBAC
// =================================================================
const authenticate: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const token = c.req.header('authorization');
  if (!token || !sessions[token]) return c.json({ error: 'No autenticado' }, 401);
  const session = sessions[token];
  if (Date.now() - session.createdAt > SESSION_TTL) {
    delete sessions[token];
    return c.json({ error: 'Sesión expirada' }, 401);
  }
  c.set('user', session);
  await next();
};

const requireAdmin: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  if (c.get('user')?.role !== 'admin')
    return c.json({ error: 'Acceso denegado. Se requiere rol de administrador' }, 403);
  await next();
};

// =================================================================
// RUTAS — PRODUCTOS
// =================================================================

// GET /api/productos
app.get('/api/productos', generalRateLimiter, zValidator('query', ProductosQuerySchema), async (c) => {
  try {
    const { busqueda, categoria, orden, desde, hasta } = c.req.valid('query');

    const conditions: ReturnType<typeof sql>[] = [];
    if (busqueda) {
      const term = `%${busqueda}%`;
      conditions.push(
        sql`(${productos.nombre} ILIKE ${term} OR ${productos.descripcion} ILIKE ${term} OR ${productos.categoria} ILIKE ${term})`
      );
    }
    if (categoria) conditions.push(eq(productos.categoria, categoria) as unknown as ReturnType<typeof sql>);
    if (desde !== undefined) conditions.push(gte(productos.precio, desde) as unknown as ReturnType<typeof sql>);
    if (hasta !== undefined) conditions.push(lte(productos.precio, hasta) as unknown as ReturnType<typeof sql>);

    const orderBy = orden === 'asc'  ? asc(productos.precio)
                  : orden === 'desc' ? desc(productos.precio)
                  : asc(productos.id);

    const rows = await db.select().from(productos)
      .where(conditions.length ? and(...conditions as Parameters<typeof and>) : undefined)
      .orderBy(orderBy);

    return c.json(rows);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// GET /api/productos/:id
app.get('/api/productos/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [producto] = await db.select().from(productos).where(eq(productos.id, id));
    if (!producto) return c.json({ error: 'Producto no encontrado' }, 404);
    return c.json(producto);
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// POST /api/productos (admin)
app.post('/api/productos', authenticate, requireAdmin, zValidator('json', ProductoBodySchema), async (c) => {
  try {
    const { nombre, descripcion, precio, imagen, categoria } = c.req.valid('json');
    const [row] = await db.insert(productos).values({
      nombre:      sanitizeText(nombre),
      descripcion: sanitizeText(descripcion || ''),
      precio,
      imagen:      imagen || '',
      categoria:   sanitizeText(categoria || ''),
    }).returning({ id: productos.id });
    return c.json({ id: row.id, mensaje: 'Producto creado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// PUT /api/productos/:id (admin)
app.put('/api/productos/:id', authenticate, requireAdmin, zValidator('json', ProductoBodySchema), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const { nombre, descripcion, precio, imagen, categoria } = c.req.valid('json');
    const result = await db.update(productos).set({
      nombre:      sanitizeText(nombre),
      descripcion: sanitizeText(descripcion || ''),
      precio,
      imagen:      imagen || '',
      categoria:   sanitizeText(categoria || ''),
    }).where(eq(productos.id, id)).returning({ id: productos.id });

    if (!result.length) return c.json({ error: 'Producto no encontrado' }, 404);
    return c.json({ mensaje: 'Producto actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// POST /api/productos/:id/imagen (admin) — sube imagen al producto
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

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.test(ext) || !ALLOWED_MIME.test(file.type))
      return c.json({ error: 'Solo se permiten imágenes (jpeg, jpg, png, gif, webp)' }, 400);
    if (file.size > 5 * 1024 * 1024)
      return c.json({ error: 'La imagen no puede superar 5MB' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    let imagenUrl: string;

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      imagenUrl = await uploadToCloudinary(buffer, 'kratamex/productos');
    } else {
      const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
      const dir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, filename), buffer);
      imagenUrl = `/uploads/${filename}`;
    }

    await db.update(productos).set({ imagen: imagenUrl }).where(eq(productos.id, id));
    return c.json({ success: true, imagen: imagenUrl });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error al subir la imagen' }, 500);
  }
});

// DELETE /api/productos/:id (admin)
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
// RUTAS — COMENTARIOS
// =================================================================

// GET /api/productos/:id/comentarios
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

// POST /api/productos/:id/comentarios
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

// POST /api/pedidos (público — checkout)
app.post('/api/pedidos', checkoutRateLimiter, zValidator('json', PedidoSchema), async (c) => {
  const { cliente, email, direccion, items } = c.req.valid('json');
  try {
    const pedidoId = await db.transaction(async (tx) => {
      let total = 0;
      const itemsValidados: { id: number; precio: number; cantidad: number }[] = [];

      for (const item of items) {
        const [prod] = await tx.select({ id: productos.id, precio: productos.precio })
          .from(productos)
          .where(eq(productos.id, item.id));
        if (!prod) throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { status: 400 });

        total += prod.precio * item.cantidad;
        itemsValidados.push({ id: prod.id, precio: prod.precio, cantidad: item.cantidad });
      }

      const [newPedido] = await tx.insert(pedidos).values({
        cliente:   sanitizeText(cliente),
        email,
        direccion: sanitizeText(direccion),
        total,
      }).returning({ id: pedidos.id });

      for (const item of itemsValidados) {
        await tx.insert(pedidoItems).values({
          pedidoId:   newPedido.id,
          productoId: item.id,
          cantidad:   item.cantidad,
          precio:     item.precio,
        });
      }
      return newPedido.id;
    });

    return c.json({ id: pedidoId, mensaje: 'Pedido creado correctamente' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'PRODUCT_NOT_FOUND')
      return c.json({ error: 'Uno o más artículos no están disponibles' }, 400);
    console.error(err);
    return c.json({ error: 'Error al procesar el pedido' }, 500);
  }
});

// GET /api/pedidos (admin)
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

// GET /api/pedidos/:id (admin)
app.get('/api/pedidos/:id', authenticate, requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'ID inválido' }, 400);

    const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, id));
    if (!pedido) return c.json({ error: 'Pedido no encontrado' }, 404);

    const items = await db
      .select({
        id:         pedidoItems.id,
        pedidoId:   pedidoItems.pedidoId,
        productoId: pedidoItems.productoId,
        cantidad:   pedidoItems.cantidad,
        precio:     pedidoItems.precio,
        nombre:     productos.nombre,
        imagen:     productos.imagen,
      })
      .from(pedidoItems)
      .innerJoin(productos, eq(pedidoItems.productoId, productos.id))
      .where(eq(pedidoItems.pedidoId, id));

    return c.json({ ...pedido, items });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// =================================================================
// RUTAS — ADMIN (pedidos)
// =================================================================

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
// RUTAS — AUTH
// =================================================================

// POST /api/login
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
      return c.json({ error: 'Credenciales incorrectas' }, 401);
    }
    delete loginAttempts[ip];
    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { id: user.id, username: user.username, role: user.role ?? 'standard', avatar: user.avatar ?? null, createdAt: Date.now() };
    return c.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar },
      message: 'Inicio de sesión correcto',
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error interno del servidor' }, 500);
  }
});

// POST /api/logout
app.post('/api/logout', (c) => {
  const token = c.req.header('authorization');
  if (token && sessions[token]) delete sessions[token];
  return c.json({ message: 'Sesión cerrada' });
});

// GET /api/usuario
app.get('/api/usuario', authenticate, (c) => {
  return c.json({ user: c.get('user') });
});

// POST /api/usuario/avatar — sube a Cloudinary o guarda localmente
app.post('/api/usuario/avatar', authenticate, async (c) => {
  const user = c.get('user');
  try {
    const body = await c.req.parseBody();
    const file = body['avatar'];

    if (!file || typeof file === 'string')
      return c.json({ error: 'No se proporcionó imagen' }, 400);

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXT.test(ext) || !ALLOWED_MIME.test(file.type))
      return c.json({ error: 'Solo se permiten imágenes (jpeg, jpg, png, gif, webp)' }, 400);
    if (file.size > 2 * 1024 * 1024)
      return c.json({ error: 'La imagen no puede superar 2MB' }, 400);

    const buffer = Buffer.from(await file.arrayBuffer());
    let avatarUrl: string;

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      avatarUrl = await uploadToCloudinary(buffer, 'kratamex/avatars');
    } else {
      // Fallback local
      const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;
      const dir = path.join(__dirname, 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, filename), buffer);
      avatarUrl = `/avatars/${filename}`;
    }

    await db.update(usuarios).set({ avatar: avatarUrl }).where(eq(usuarios.id, user.id));

    const token = c.req.header('authorization')!;
    if (sessions[token]) sessions[token].avatar = avatarUrl;

    return c.json({ success: true, avatar: avatarUrl, message: 'Avatar actualizado' });
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Error al subir la imagen' }, 500);
  }
});

// =================================================================
// ERROR HANDLER GLOBAL
// =================================================================
app.onError((err, c) => {
  console.error(err);
  if (err.message?.includes('CORS')) return c.json({ error: 'Origen no permitido' }, 403);
  return c.json({ error: 'Error interno del servidor' }, 500);
});

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404));

// =================================================================
// INICIALIZACIÓN — Tablas, Seed, Arranque
// =================================================================
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT    NOT NULL,
      descripcion TEXT,
      precio      REAL    NOT NULL,
      imagen      TEXT,
      categoria   TEXT,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS pedidos (
      id        SERIAL PRIMARY KEY,
      cliente   TEXT NOT NULL,
      email     TEXT NOT NULL,
      direccion TEXT NOT NULL,
      total     REAL NOT NULL,
      fecha     TIMESTAMPTZ DEFAULT NOW()
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
      role       TEXT DEFAULT 'standard' CHECK(role IN ('admin','standard')),
      avatar     TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS comentarios (
      id          SERIAL PRIMARY KEY,
      producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      autor       TEXT    NOT NULL,
      contenido   TEXT    NOT NULL,
      fecha       TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('PostgreSQL: tablas verificadas');
}

async function seedProductos() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM productos');
  if (parseInt(result.rows[0].count) > 0) return;
  const data = [
    ['MacBook Pro 14"',           'Apple M3 Pro, 18GB RAM, 512GB SSD, Pantalla Liquid Retina XDR',                    2249.00, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop',   'Portátiles'],
    ['Dell XPS 15',               'Intel Core i7-13700H, 32GB RAM, 1TB SSD, NVIDIA RTX 4060, 15.6" 3.5K OLED',       1899.00, 'https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&h=300&fit=crop',   'Portátiles'],
    ['HP Spectre x360',           'Intel Core i7-1255U, 16GB RAM, 512GB SSD, Pantalla 14" FHD Táctil 2-en-1',        1499.00, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&h=300&fit=crop',   'Portátiles'],
    ['Lenovo ThinkPad X1 Carbon', 'Intel Core i7-1365U, 16GB RAM, 512GB SSD, Pantalla 14" 2.8K OLED',                1799.00, 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=400&h=300&fit=crop',   'Portátiles'],
    ['LG Gram 17',                'Intel Core i7-1360P, 32GB RAM, 1TB SSD, Pantalla 17" WQXGA, Peso 1.35kg',         2199.00, 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=400&h=300&fit=crop',     'Portátiles'],
    ['Samsung Galaxy Book4 Pro',  'Intel Core Ultra 7 155H, 16GB RAM, 512GB SSD, Pantalla 14" AMOLED 120Hz',         1449.00, 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=400&h=300&fit=crop',   'Portátiles'],
    ['ASUS ROG Strix G16',        'Intel Core i9-13980HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16" FHD 165Hz',        2199.00, 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=400&h=300&fit=crop',   'Gaming'],
    ['Alienware m18',             'Intel Core i9-13980HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 18" QHD+ 165Hz',       3499.00, 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=400&h=300&fit=crop',   'Gaming'],
    ['MSI Titan GT77',            'Intel Core i9-13900HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 17.3" 4K 144Hz',       3799.00, 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&h=300&fit=crop',   'Gaming'],
    ['Razer Blade 15',            'Intel Core i7-13800H, 16GB RAM, 1TB SSD, NVIDIA RTX 4070, 15.6" QHD 240Hz',       2499.00, 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=400&h=300&fit=crop',   'Gaming'],
    ['HP Omen 16',                'AMD Ryzen 9 7940HS, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16.1" QHD 165Hz',         1699.00, 'https://images.unsplash.com/photo-1618424181497-157f25b6ddd5?w=400&h=300&fit=crop',   'Gaming'],
    ['Acer Predator Helios 18',   'Intel Core i9-13900HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4080, 18" WQXGA 240Hz',      2699.00, 'https://images.unsplash.com/photo-1620283085439-39620a119571?w=400&h=300&fit=crop',   'Gaming'],
    ['Apple iMac 24"',            'Apple M3, 8GB RAM, 256GB SSD, Pantalla 4.5K Retina 24", Cámara 1080p',             1499.00, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&h=300&fit=crop',   'Sobremesa'],
    ['Dell Inspiron 24',          'Intel Core i7-1355U, 16GB RAM, 512GB SSD, Pantalla 23.8" FHD Táctil',             1099.00, 'https://images.unsplash.com/photo-1547082299-de196ea013d6?w=400&h=300&fit=crop',     'Sobremesa'],
    ['HP Pavilion 27',            'AMD Ryzen 7 7735HS, 16GB RAM, 512GB SSD, Pantalla 27" QHD',                       1199.00, 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=300&fit=crop',   'Sobremesa'],
  ];
  for (const [nombre, descripcion, precio, imagen, categoria] of data) {
    await pool.query(
      'INSERT INTO productos (nombre, descripcion, precio, imagen, categoria) VALUES ($1,$2,$3,$4,$5)',
      [nombre, descripcion, precio, imagen, categoria]
    );
  }
  console.log('Productos de ejemplo insertados');
}

async function seedUsuarios() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
  const count  = parseInt(result.rows[0].count);

  const adminUser = process.env.ADMIN_USER    || 'admin';
  const adminPass = process.env.ADMIN_PASS    || 'admin123';
  const stdUser   = process.env.USER_STANDARD || 'user';
  const stdPass   = process.env.USER_PASS     || 'user123';

  if (count === 0) {
    await pool.query(
      'INSERT INTO usuarios (username, password, email, role) VALUES ($1,$2,$3,$4)',
      [adminUser, await argon2.hash(adminPass), 'admin@kratamex.com', 'admin']
    );
    await pool.query(
      'INSERT INTO usuarios (username, password, email, role) VALUES ($1,$2,$3,$4)',
      [stdUser, await argon2.hash(stdPass), 'user@kratamex.com', 'standard']
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
      'INSERT INTO pedidos (cliente, email, direccion, total, fecha) VALUES ($1,$2,$3,$4,$5)',
      [p.cliente, p.email, p.direccion, p.total, fecha.toISOString()]
    );
  }
  console.log('Pedidos de ejemplo insertados');
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
    serve({ fetch: app.fetch, port: PORT }, () =>
      console.log(`Backend Hono corriendo en http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error('Error al iniciar el backend:', err);
    process.exit(1);
  }
})();
