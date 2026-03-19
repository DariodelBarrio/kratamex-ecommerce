/*
=================================================================
KRATAMEX — BACKEND (API REST)
=================================================================
Base de datos: PostgreSQL (via node-postgres / pg)
Todas las queries son async/await con prepared statements ($1, $2...)
=================================================================
*/

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const argon2     = require('argon2');
const pool       = require('./db');

const PORT = 3001;

// =================================================================
// MULTER — subida de imágenes de producto
// =================================================================
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase()) &&
        /jpeg|jpg|png|gif|webp/.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
});

// =================================================================
// MULTER — avatar de usuario
// =================================================================
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase()) &&
        /jpeg|jpg|png|gif|webp/.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes'));
  }
});

// =================================================================
// LOGGER
// =================================================================
const LOG_FILE = path.join(__dirname, 'access.log');

function logRequest(req, res, next) {
  const entry = `[${new Date().toISOString()}] ${req.ip} - ${req.method} ${req.url}\n`;
  fs.appendFile(LOG_FILE, entry, (err) => { if (err) console.error('Log error:', err); });
  next();
}

// =================================================================
// SERVIDOR
// =================================================================
const app = express();

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'https://localhost';
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === ALLOWED_ORIGIN) return cb(null, true);
    cb(new Error('Origen no permitido por CORS'));
  }
}));
app.use(express.json());
app.use(logRequest);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/avatars',  express.static(path.join(__dirname, 'avatars')));

// =================================================================
// RATE LIMITING — login (fuerza bruta)
// =================================================================
const loginAttempts = {};
const MAX_ATTEMPTS     = 12;
const BLOCK_DURATION   = 60 * 1000;

function loginRateLimiter(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  const rec = loginAttempts[ip];
  if (rec?.blockedUntil && now < rec.blockedUntil) {
    const seg = Math.ceil((rec.blockedUntil - now) / 1000);
    fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] RATE_LIMIT ip=${ip}\n`, () => {});
    return res.status(429).json({ error: `Demasiados intentos. Intenta en ${seg} segundos.` });
  }
  next();
}

function recordFailedLogin(ip) {
  if (!loginAttempts[ip]) loginAttempts[ip] = { count: 0, blockedUntil: null };
  loginAttempts[ip].count += 1;
  if (loginAttempts[ip].count >= MAX_ATTEMPTS) {
    loginAttempts[ip].blockedUntil = Date.now() + BLOCK_DURATION;
    fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] BLOQUEADO ip=${ip}\n`, () => {});
  }
}
function resetLoginAttempts(ip) { delete loginAttempts[ip]; }

// =================================================================
// RATE LIMITING — checkout (anti-flood / DoS)
// =================================================================
const checkoutAttempts   = {};
const MAX_CHECKOUT       = 10;
const CHECKOUT_WINDOW    = 60 * 1000;

function checkoutRateLimiter(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  if (!checkoutAttempts[ip] || now - checkoutAttempts[ip].windowStart > CHECKOUT_WINDOW) {
    checkoutAttempts[ip] = { count: 1, windowStart: now };
    return next();
  }
  if (++checkoutAttempts[ip].count > MAX_CHECKOUT) {
    fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] CHECKOUT_FLOOD ip=${ip}\n`, () => {});
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' });
  }
  next();
}

// =================================================================
// AUTENTICACIÓN + RBAC
// =================================================================
const sessions = {};

function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token || !sessions[token]) return res.status(401).json({ error: 'No autenticado' });
  req.user = sessions[token];
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  next();
}

// =================================================================
// RUTAS — PRODUCTOS
// =================================================================

// GET /api/productos  — filtros opcionales: busqueda, categoria, orden, desde, hasta
app.get('/api/productos', async (req, res) => {
  try {
    const { busqueda, categoria, orden, desde, hasta } = req.query;
    let sql    = 'SELECT * FROM productos WHERE TRUE';
    const params = [];
    let idx    = 1;

    if (busqueda) {
      sql += ` AND (nombre ILIKE $${idx} OR descripcion ILIKE $${idx+1} OR categoria ILIKE $${idx+2})`;
      const term = `%${busqueda}%`;
      params.push(term, term, term);
      idx += 3;
    }
    if (categoria) { sql += ` AND categoria = $${idx++}`;          params.push(categoria); }
    if (desde)     { sql += ` AND precio >= $${idx++}`;            params.push(parseFloat(desde)); }
    if (hasta)     { sql += ` AND precio <= $${idx++}`;            params.push(parseFloat(hasta)); }

    if      (orden === 'asc')  sql += ' ORDER BY precio ASC';
    else if (orden === 'desc') sql += ' ORDER BY precio DESC';
    else                       sql += ' ORDER BY id ASC';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/productos/:id
app.get('/api/productos/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/productos  (admin)
app.post('/api/productos', authenticate, requireAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, imagen, categoria } = req.body;
    if (!nombre || !precio) return res.status(400).json({ error: 'Nombre y precio son requeridos' });
    const { rows } = await pool.query(
      'INSERT INTO productos (nombre, descripcion, precio, imagen, categoria) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [nombre, descripcion || '', precio, imagen || '', categoria || '']
    );
    res.json({ id: rows[0].id, mensaje: 'Producto creado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/productos/:id  (admin)
app.put('/api/productos/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, imagen, categoria } = req.body;
    const result = await pool.query(
      'UPDATE productos SET nombre=$1, descripcion=$2, precio=$3, imagen=$4, categoria=$5 WHERE id=$6',
      [nombre, descripcion, precio, imagen, categoria, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/productos/:id  (admin)
app.delete('/api/productos/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =================================================================
// RUTAS — PEDIDOS
// =================================================================

// POST /api/pedidos  — checkout público con validación de precio server-side
app.post('/api/pedidos', checkoutRateLimiter, async (req, res) => {
  const { cliente, email, direccion, items } = req.body;
  if (!cliente || !email || !direccion || !items?.length)
    return res.status(400).json({ error: 'Faltan datos requeridos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let total = 0;
    const itemsValidados = [];

    for (const item of items) {
      // FIX price manipulation: precio siempre desde la BD, nunca del cliente
      const { rows } = await client.query('SELECT id, precio FROM productos WHERE id = $1', [item.id]);
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Uno o más artículos no están disponibles' });
      }
      const cantidad = parseInt(item.cantidad);
      if (!cantidad || cantidad < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cantidad inválida' });
      }
      total += rows[0].precio * cantidad;
      itemsValidados.push({ id: rows[0].id, precio: rows[0].precio, cantidad });
    }

    const { rows: pedidoRows } = await client.query(
      'INSERT INTO pedidos (cliente, email, direccion, total) VALUES ($1,$2,$3,$4) RETURNING id',
      [cliente, email, direccion, total]
    );
    const pedidoId = pedidoRows[0].id;

    for (const item of itemsValidados) {
      await client.query(
        'INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES ($1,$2,$3,$4)',
        [pedidoId, item.id, item.cantidad, item.precio]
      );
    }

    await client.query('COMMIT');
    res.json({ id: pedidoId, mensaje: 'Pedido creado correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al procesar el pedido' });
  } finally {
    client.release();
  }
});

// GET /api/pedidos  (solo admin)
app.get('/api/pedidos', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pedidos ORDER BY fecha DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/pedidos/:id  (solo admin)
app.get('/api/pedidos/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows: pedidoRows } = await pool.query('SELECT * FROM pedidos WHERE id = $1', [req.params.id]);
    if (!pedidoRows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });

    const { rows: items } = await pool.query(`
      SELECT pi.*, p.nombre, p.imagen
      FROM pedido_items pi
      JOIN productos p ON pi.producto_id = p.id
      WHERE pi.pedido_id = $1
    `, [req.params.id]);

    res.json({ ...pedidoRows[0], items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =================================================================
// RUTAS — ADMIN (pedidos)
// =================================================================

// GET /api/admin/pedidos
app.get('/api/admin/pedidos', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM pedidos ORDER BY fecha DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/admin/pedidos/:id
app.delete('/api/admin/pedidos/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM pedidos WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json({ mensaje: 'Pedido eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =================================================================
// RUTAS — AUTH
// =================================================================

// POST /api/login
app.post('/api/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  if (!username || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    const user = rows[0];

    let passwordValida = false;
    if (user) {
      try { passwordValida = await argon2.verify(user.password, password); }
      catch { passwordValida = false; }
    }

    if (!user || !passwordValida) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    resetLoginAttempts(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { id: user.id, username: user.username, role: user.role, avatar: user.avatar };

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar },
      message: 'Inicio de sesión correcto'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization;
  if (token && sessions[token]) delete sessions[token];
  res.json({ message: 'Sesión cerrada' });
});

// GET /api/usuario
app.get('/api/usuario', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/usuario/avatar
app.post('/api/usuario/avatar', authenticate, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se proporcionó imagen' });
  try {
    const avatarUrl = `/avatars/${req.file.filename}`;
    await pool.query('UPDATE usuarios SET avatar = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    req.user.avatar = avatarUrl;
    sessions[req.headers.authorization].avatar = avatarUrl;
    res.json({ success: true, avatar: avatarUrl, message: 'Avatar actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

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
  `);
  console.log('PostgreSQL: tablas verificadas');
}

async function seedProductos() {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM productos');
  if (parseInt(rows[0].count) > 0) return;

  const productos = [
    ['MacBook Pro 14"',          'Apple M3 Pro, 18GB RAM, 512GB SSD, Pantalla Liquid Retina XDR',                    2249.00, 'MacBook',   'Portátiles'],
    ['Dell XPS 15',              'Intel Core i7-13700H, 32GB RAM, 1TB SSD, NVIDIA RTX 4060, 15.6" 3.5K OLED',       1899.00, 'Dell',      'Portátiles'],
    ['HP Spectre x360',          'Intel Core i7-1255U, 16GB RAM, 512GB SSD, Pantalla 14" FHD Táctil 2-en-1',        1499.00, 'HP',        'Portátiles'],
    ['Lenovo ThinkPad X1 Carbon','Intel Core i7-1365U, 16GB RAM, 512GB SSD, Pantalla 14" 2.8K OLED',                1799.00, 'Lenovo',    'Portátiles'],
    ['LG Gram 17',               'Intel Core i7-1360P, 32GB RAM, 1TB SSD, Pantalla 17" WQXGA, Peso 1.35kg',         2199.00, 'LG',        'Portátiles'],
    ['Samsung Galaxy Book4 Pro', 'Intel Core Ultra 7 155H, 16GB RAM, 512GB SSD, Pantalla 14" AMOLED 120Hz',         1449.00, 'Samsung',   'Portátiles'],
    ['ASUS ROG Strix G16',       'Intel Core i9-13980HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16" FHD 165Hz',        2199.00, 'ASUS',      'Gaming'],
    ['Alienware m18',            'Intel Core i9-13980HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 18" QHD+ 165Hz',       3499.00, 'Alienware', 'Gaming'],
    ['MSI Titan GT77',           'Intel Core i9-13900HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, 17.3" 4K 144Hz',       3799.00, 'MSI',       'Gaming'],
    ['Razer Blade 15',           'Intel Core i7-13800H, 16GB RAM, 1TB SSD, NVIDIA RTX 4070, 15.6" QHD 240Hz',       2499.00, 'Razer',     'Gaming'],
    ['HP Omen 16',               'AMD Ryzen 9 7940HS, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, 16.1" QHD 165Hz',         1699.00, 'HP',        'Gaming'],
    ['Acer Predator Helios 18',  'Intel Core i9-13900HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4080, 18" WQXGA 240Hz',      2699.00, 'Acer',      'Gaming'],
    ['Apple iMac 24"',           'Apple M3, 8GB RAM, 256GB SSD, Pantalla 4.5K Retina 24", Cámara 1080p',             1499.00, 'Apple',     'Sobremesa'],
    ['Dell Inspiron 24',         'Intel Core i7-1355U, 16GB RAM, 512GB SSD, Pantalla 23.8" FHD Táctil',             1099.00, 'Dell',      'Sobremesa'],
    ['HP Pavilion 27',           'AMD Ryzen 7 7735HS, 16GB RAM, 512GB SSD, Pantalla 27" QHD',                       1199.00, 'HP',        'Sobremesa'],
  ];

  for (const [nombre, descripcion, precio, imgKey, categoria] of productos) {
    const imagen = `https://placehold.co/400x300/1e293b/94a3b8?text=${encodeURIComponent(imgKey)}`;
    await pool.query(
      'INSERT INTO productos (nombre, descripcion, precio, imagen, categoria) VALUES ($1,$2,$3,$4,$5)',
      [nombre, descripcion, precio, imagen, categoria]
    );
  }
  console.log('Productos de ejemplo insertados');
}

async function seedUsuarios() {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
  const count = parseInt(rows[0].count);

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
    // Migrar hashes no-argon2 (bcrypt o texto plano)
    const known = { [adminUser]: adminPass, [stdUser]: stdPass };
    const { rows: usuarios } = await pool.query('SELECT id, username, password FROM usuarios');
    for (const u of usuarios) {
      if (!u.password.startsWith('$argon2') && known[u.username]) {
        await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2',
          [await argon2.hash(known[u.username]), u.id]);
        console.log(`Contraseña de ${u.username} migrada a argon2id`);
      }
    }
  }
}

async function seedPedidos() {
  const { rows } = await pool.query('SELECT COUNT(*) AS count FROM pedidos');
  if (parseInt(rows[0].count) > 0) return;

  // Distribuidos en 7 días para visualización de gráficas
  const pedidos = [
    { cliente: 'Juan Pérez',       email: 'juan@email.com',    direccion: 'Calle Mayor 123, Madrid',         total: 2249.00, daysAgo: 6 },
    { cliente: 'María García',     email: 'maria@email.com',   direccion: 'Av. Roma 45, Barcelona',          total: 1899.00, daysAgo: 6 },
    { cliente: 'Carlos López',     email: 'carlos@email.com',  direccion: 'Plaza España 10, Valencia',       total: 1499.00, daysAgo: 5 },
    { cliente: 'Ana Martínez',     email: 'ana@email.com',     direccion: 'Gran Vía 88, Madrid',             total: 3499.00, daysAgo: 5 },
    { cliente: 'Pedro Sánchez',    email: 'pedro@email.com',   direccion: 'Paseo de Gracia 32, Barcelona',   total: 2199.00, daysAgo: 4 },
    { cliente: 'Laura Gómez',      email: 'laura@email.com',   direccion: 'Calle Sierpes 7, Sevilla',        total: 1099.00, daysAgo: 4 },
    { cliente: 'Roberto Díaz',     email: 'roberto@email.com', direccion: 'Av. Constitución 15, Sevilla',    total: 1799.00, daysAgo: 3 },
    { cliente: 'Elena Fernández',  email: 'elena@email.com',   direccion: 'C/ Larios 22, Málaga',            total: 2499.00, daysAgo: 2 },
    { cliente: 'Miguel Torres',    email: 'miguel@email.com',  direccion: 'Rúa do Vilar 5, Santiago',        total: 1449.00, daysAgo: 2 },
    { cliente: 'Sofía Ruiz',       email: 'sofia@email.com',   direccion: 'Calle Mayor 55, Zaragoza',        total: 2699.00, daysAgo: 1 },
    { cliente: 'David Moreno',     email: 'david@email.com',   direccion: 'Paseo Castellana 100, Madrid',    total: 3799.00, daysAgo: 1 },
    { cliente: 'Carmen Jiménez',   email: 'carmen@email.com',  direccion: 'Av. Diagonal 200, Barcelona',     total: 1199.00, daysAgo: 0 },
  ];

  for (const p of pedidos) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - p.daysAgo);
    await pool.query(
      'INSERT INTO pedidos (cliente, email, direccion, total, fecha) VALUES ($1,$2,$3,$4,$5)',
      [p.cliente, p.email, p.direccion, p.total, fecha.toISOString()]
    );
  }
  console.log('Pedidos de ejemplo insertados');
}

// =================================================================
// ARRANQUE — con retry para esperar a que PostgreSQL esté listo
// (Docker DNS puede tardar 1-2s en resolver el hostname del servicio)
// =================================================================
async function waitForDB(maxAttempts = 15, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('PostgreSQL: conexión establecida');
      return;
    } catch (err) {
      console.log(`PostgreSQL: intento ${i}/${maxAttempts} fallido (${err.message}). Reintentando en ${delayMs}ms...`);
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
    app.listen(PORT, () => console.log(`Backend corriendo en http://localhost:${PORT}`));
  } catch (err) {
    console.error('Error al iniciar el backend:', err);
    process.exit(1);
  }
})();
