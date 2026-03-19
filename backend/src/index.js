/* 
=================================================================
KRATAMEX - BACKEND (API REST)
=================================================================
Este archivo contiene el servidor backend de la tienda.
Está escrito en Node.js con Express.

Funcionalidades:
- Servir API REST para productos y pedidos
- Base de datos SQLite (archivo local)
- Rutas CRUD para productos
- Rutas para crear y listar pedidos
=================================================================
*/

// =================================================================
// IMPORTACIONES
// =================================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const argon2 = require('argon2');

// =================================================================
// CONFIGURACIÓN DE MULTER (SUBIDA DE IMÁGENES)
// =================================================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
});

// =================================================================
// CONFIGURACIÓN DEL LOGGER
// =================================================================
const LOG_FILE = path.join(__dirname, 'access.log');

function logRequest(req, res, next) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${req.ip} - ${req.method} ${req.url}\n`;
  fs.appendFile(LOG_FILE, logEntry, (err) => { if (err) console.error('Error writing to log:', err); });
  next();
}

// =================================================================
// CONFIGURACIÓN DEL SERVIDOR
// =================================================================
const app = express();
const PORT = 3001;

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'https://localhost';
app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (curl, Postman, mismo servidor)
    if (!origin || origin === ALLOWED_ORIGIN) return callback(null, true);
    callback(new Error('Origen no permitido por CORS'));
  }
}));
app.use(express.json());
app.use(logRequest);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/avatars', express.static(path.join(__dirname, 'avatars')));

// =================================================================
// BASE DE DATOS
// =================================================================
// Crear/Conectar a la base de datos SQLite (archivo: tienda.db)
// Si el archivo no existe, lo crea automáticamente
const db = new Database('tienda.db');

// =================================================================
// CREAR TABLAS
// =================================================================
// Crear las tablas de la base de datos si no existen
// Esto es como crear la estructura de una hoja de cálculo
db.exec(`
  -- Tabla de productos (artículos en venta)
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- ID automático
    nombre TEXT NOT NULL,                   -- Nombre del producto
    descripcion TEXT,                       -- Descripción
    precio REAL NOT NULL,                   -- Precio (número decimal)
    imagen TEXT,                            -- URL de la imagen
    categoria TEXT,                         -- Categoría del producto
    fecha TEXT DEFAULT CURRENT_TIMESTAMP    -- Fecha de creación
  );

  -- Tabla de pedidos (compras realizadas)
  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,                  -- Nombre del cliente
    email TEXT NOT NULL,                    -- Correo del cliente
    direccion TEXT NOT NULL,                -- Dirección de envío
    total REAL NOT NULL,                    -- Total de la compra
    fecha TEXT DEFAULT CURRENT_TIMESTAMP    -- Fecha automática
  );

  -- Tabla de items del pedido (qué productos bought en cada pedido)
  CREATE TABLE IF NOT EXISTS pedido_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,            -- ID del pedido (relación)
    producto_id INTEGER NOT NULL,          -- ID del producto (relación)
    cantidad INTEGER NOT NULL,             -- Cuántos se bought
    precio REAL NOT NULL,                  -- Precio en el momento de la compra
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  );

  -- Tabla de usuarios (para RBAC)
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'standard' CHECK(role IN ('admin', 'standard')),
    avatar TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// =================================================================
// DATOS DE EJEMPLO (SEED)
// =================================================================
// Si no hay productos en la base de datos, agregar algunos de ejemplo
const productosExistentes = db.prepare('SELECT COUNT(*) as count FROM productos').get();
if (productosExistentes.count === 0) {
  // Preparar la consulta SQL para insertar productos
  const insert = db.prepare('INSERT INTO productos (nombre, descripcion, precio, imagen, categoria) VALUES (?, ?, ?, ?, ?)');
  
// =================================================================
// GENERADOR DE IMÁGENES DE PLACEHOLDER
// =================================================================
function generatePlaceholderImage(text) {
  const colors = {
    'Portátiles': ['1a1a2e', '16213e', '0f3460'],
    'Gaming': ['1a1a2e', '0f0f23', '2d132c'],
    'Sobremesa': ['1e3a5f', '2c3e50', '34495e']
  };
  const color = colors['Portátiles'][Math.floor(Math.random() * 3)];
  const textEncoded = encodeURIComponent(text);
  return `https://placehold.co/400x300/${color}/ffffff?text=${textEncoded}`;
}

const getImageForProduct = (nombre, categoria) => {
  const cleanName = nombre.replace(/"/g, '').split(' ')[0];
  return generatePlaceholderImage(cleanName);
};

// Lista de productos de ejemplo
const productos = [
  ['MacBook Pro 14"', 'Apple M3 Pro, 18GB RAM, 512GB SSD, Pantalla Liquid Retina XDR', 2249.00, getImageForProduct('MacBook Pro 14"', 'Portátiles'), 'Portátiles'],
  ['Dell XPS 15', 'Intel Core i7-13700H, 32GB RAM, 1TB SSD, NVIDIA RTX 4060, Pantalla 15.6" 3.5K OLED', 1899.00, getImageForProduct('Dell XPS 15', 'Portátiles'), 'Portátiles'],
  ['HP Spectre x360', 'Intel Core i7-1255U, 16GB RAM, 512GB SSD, Pantalla 14" FHD Táctil 2-en-1', 1499.00, getImageForProduct('HP Spectre', 'Portátiles'), 'Portátiles'],
  ['Lenovo ThinkPad X1 Carbon', 'Intel Core i7-1365U, 16GB RAM, 512GB SSD, Pantalla 14" 2.8K OLED', 1799.00, getImageForProduct('ThinkPad', 'Portátiles'), 'Portátiles'],
  ['ASUS ROG Strix G16', 'Intel Core i9-13980HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, Pantalla 16" FHD 165Hz', 2199.00, getImageForProduct('ROG Strix', 'Gaming'), 'Gaming'],
  ['Alienware m18', 'Intel Core i9-13980HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, Pantalla 18" QHD+ 165Hz', 3499.00, getImageForProduct('Alienware', 'Gaming'), 'Gaming'],
  ['MSI Titan GT77', 'Intel Core i9-13900HX, 64GB RAM, 2TB SSD, NVIDIA RTX 4090, Pantalla 17.3" 4K 144Hz', 3799.00, getImageForProduct('MSI Titan', 'Gaming'), 'Gaming'],
  ['Razer Blade 15', 'Intel Core i7-13800H, 16GB RAM, 1TB SSD, NVIDIA RTX 4070, Pantalla 15.6" QHD 240Hz', 2499.00, getImageForProduct('Razer Blade', 'Gaming'), 'Gaming'],
  ['HP Omen 16', 'AMD Ryzen 9 7940HS, 32GB RAM, 1TB SSD, NVIDIA RTX 4070, Pantalla 16.1" QHD 165Hz', 1699.00, getImageForProduct('HP Omen', 'Gaming'), 'Gaming'],
  ['Acer Predator Helios 18', 'Intel Core i9-13900HX, 32GB RAM, 1TB SSD, NVIDIA RTX 4080, Pantalla 18" WQXGA 240Hz', 2699.00, getImageForProduct('Predator', 'Gaming'), 'Gaming'],
  ['Apple iMac 24"', 'Apple M3, 8GB RAM, 256GB SSD, Pantalla 4.5K Retina 24", Cámara 1080p', 1499.00, getImageForProduct('iMac', 'Sobremesa'), 'Sobremesa'],
  ['Dell Inspiron 24', 'Intel Core i7-1355U, 16GB RAM, 512GB SSD, Pantalla 23.8" FHD Táctil', 1099.00, getImageForProduct('Inspiron', 'Sobremesa'), 'Sobremesa'],
  ['HP Pavilion 27', 'AMD Ryzen 7 7735HS, 16GB RAM, 512GB SSD, Pantalla 27" QHD', 1199.00, getImageForProduct('Pavilion', 'Sobremesa'), 'Sobremesa'],
  ['LG Gram 17', 'Intel Core i7-1360P, 32GB RAM, 1TB SSD, Pantalla 17" WQXGA, Peso 1.35kg', 2199.00, getImageForProduct('LG Gram', 'Portátiles'), 'Portátiles'],
  ['Samsung Galaxy Book4 Pro', 'Intel Core Ultra 7 155H, 16GB RAM, 512GB SSD, Pantalla 14" AMOLED 120Hz', 1449.00, getImageForProduct('Galaxy Book', 'Portátiles'), 'Portátiles']
];

  // Insertar cada producto
  for (const p of productos) {
    insert.run(...p);
  }
  console.log('Productos de ejemplo insertados');
}

// Seed de usuarios y migración de contraseñas — async porque argon2 es asíncrono
async function initUsuarios() {
  const usuariosExistentes = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const stdUser   = process.env.USER_STANDARD || 'user';
  const stdPass   = process.env.USER_PASS || 'user123';

  if (usuariosExistentes.count === 0) {
    const adminHash = await argon2.hash(adminPass);
    const stdHash   = await argon2.hash(stdPass);
    db.prepare('INSERT INTO usuarios (username, password, email, role) VALUES (?, ?, ?, ?)').run(adminUser, adminHash, 'admin@kratamex.com', 'admin');
    db.prepare('INSERT INTO usuarios (username, password, email, role) VALUES (?, ?, ?, ?)').run(stdUser,   stdHash,   'user@kratamex.com',  'standard');
    console.log('Usuarios creados con argon2id');
  } else {
    // Migrar hashes que no sean argon2 ($2b$ = bcrypt, sin prefijo = texto plano)
    const knownPasswords = {
      [adminUser]: adminPass,
      [stdUser]:   stdPass,
    };
    const usuarios = db.prepare('SELECT id, username, password FROM usuarios').all();
    const update   = db.prepare('UPDATE usuarios SET password = ? WHERE id = ?');
    for (const u of usuarios) {
      if (!u.password.startsWith('$argon2')) {
        const plain = knownPasswords[u.username];
        if (plain) {
          update.run(await argon2.hash(plain), u.id);
          console.log(`Contraseña de ${u.username} migrada a argon2id`);
        }
      }
    }
  }
}

// Seed de pedidos de ejemplo
const pedidosExistentes = db.prepare('SELECT COUNT(*) as count FROM pedidos').get();
if (pedidosExistentes.count === 0) {
  db.prepare('INSERT INTO pedidos (cliente, email, direccion, total) VALUES (?, ?, ?, ?)').run('Juan Pérez', 'juan@email.com', 'Calle Mayor 123, Madrid', 1499.98);
  db.prepare('INSERT INTO pedidos (cliente, email, direccion, total) VALUES (?, ?, ?, ?)').run('María García', 'maria@email.com', 'Av. Roma 45, Barcelona', 899.99);
  db.prepare('INSERT INTO pedidos (cliente, email, direccion, total) VALUES (?, ?, ?, ?)').run('Carlos López', 'carlos@email.com', 'Plaza España 10, Valencia', 549.98);
  const pedido1Id = 1;
  const pedido2Id = 2;
  const pedido3Id = 3;
  db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)').run(pedido1Id, 1, 1, 1299.99);
  db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)').run(pedido1Id, 2, 1, 199.99);
  db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)').run(pedido2Id, 2, 1, 899.99);
  db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)').run(pedido3Id, 7, 1, 499.99);
  db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)').run(pedido3Id, 8, 1, 129.99);
  console.log('Pedidos de ejemplo insertados');
}

// =================================================================
// RATE LIMITING GENÉRICO (fuerza bruta y flood)
// =================================================================
const loginAttempts = {}; // { ip: { count, blockedUntil } }
const MAX_ATTEMPTS = 12;
const BLOCK_DURATION_MS = 60 * 1000; // 60 segundos

function loginRateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const record = loginAttempts[ip];

  if (record && record.blockedUntil && now < record.blockedUntil) {
    const segundosRestantes = Math.ceil((record.blockedUntil - now) / 1000);
    const logEntry = `[${new Date().toISOString()}] RATE_LIMIT BLOQUEADO ip=${ip} segundos_restantes=${segundosRestantes}\n`;
    fs.appendFile(LOG_FILE, logEntry, () => {});
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${segundosRestantes} segundos.`
    });
  }

  next();
}

// Rate limiter para checkout: máx 10 pedidos/IP cada 60s (anti-flood/DoS)
const checkoutAttempts = {}; // { ip: { count, windowStart } }
const MAX_CHECKOUT_PER_WINDOW = 10;
const CHECKOUT_WINDOW_MS = 60 * 1000;

function checkoutRateLimiter(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  if (!checkoutAttempts[ip] || now - checkoutAttempts[ip].windowStart > CHECKOUT_WINDOW_MS) {
    checkoutAttempts[ip] = { count: 1, windowStart: now };
    return next();
  }
  checkoutAttempts[ip].count += 1;
  if (checkoutAttempts[ip].count > MAX_CHECKOUT_PER_WINDOW) {
    const logEntry = `[${new Date().toISOString()}] CHECKOUT_FLOOD ip=${ip} intentos=${checkoutAttempts[ip].count}\n`;
    fs.appendFile(LOG_FILE, logEntry, () => {});
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' });
  }
  next();
}

function recordFailedLogin(ip) {
  const now = Date.now();
  if (!loginAttempts[ip]) {
    loginAttempts[ip] = { count: 0, blockedUntil: null };
  }
  loginAttempts[ip].count += 1;
  if (loginAttempts[ip].count >= MAX_ATTEMPTS) {
    loginAttempts[ip].blockedUntil = now + BLOCK_DURATION_MS;
    const logEntry = `[${new Date().toISOString()}] RATE_LIMIT ip=${ip} bloqueada por ${BLOCK_DURATION_MS / 1000} segundos tras ${MAX_ATTEMPTS} intentos fallidos\n`;
    fs.appendFile(LOG_FILE, logEntry, () => {});
  }
}

function resetLoginAttempts(ip) {
  delete loginAttempts[ip];
}

// =================================================================
// MIDDLEWARE DE AUTENTICACIÓN Y RBAC
// =================================================================
const sessions = {};

function authenticate(req, res, next) {
  const token = req.headers.authorization;
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  req.user = sessions[token];
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
}

// =================================================================
// RUTAS DE LA API
// =================================================================

// --------------------------------------------------------------------------
// GET /api/productos
// Obtener todos los productos con filtros opcionales
// Parámetros (query string):
//   - busqueda: texto para buscar en nombre, descripción o categoría
//   - categoria: filtrar por categoría específica
//   - desde: precio mínimo
//   - hasta: precio máximo
//   - fechaDesde: fecha mínima de creación
//   - fechaHasta: fecha máxima de creación
//   - orden: 'asc' o 'desc' para ordenar por precio
// --------------------------------------------------------------------------
app.get('/api/productos', (req, res) => {
  // Obtener parámetros de la URL (query string)
  const { busqueda, categoria, orden, desde, hasta, fechaDesde, fechaHasta } = req.query;
  
  // Comenzar con consulta base (obtener todos)
  let sql = 'SELECT * FROM productos WHERE 1=1';  // 1=1 es siempre verdadero (para agregar condiciones)
  const params = [];  // Parámetros para el prepared statement (previene SQL injection)
  
  // Si hay búsqueda, agregar filtro (usando LIKE para búsqueda parcial)
  if (busqueda) {
    sql += ' AND (nombre LIKE ? OR descripcion LIKE ? OR categoria LIKE ?)';
    const term = `%${busqueda}%`;  // % permite buscar en cualquier parte del texto
    params.push(term, term, term);
  }
  
  // Si hay categoría específica, agregar filtro
  if (categoria) {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }
  
  // Filtro por rango de precio
  if (desde) {
    sql += ' AND precio >= ?';
    params.push(parseFloat(desde));
  }
  if (hasta) {
    sql += ' AND precio <= ?';
    params.push(parseFloat(hasta));
  }
  
  // Filtro por rango de fecha
  if (fechaDesde) {
    sql += ' AND fecha >= ?';
    params.push(fechaDesde);
  }
  if (fechaHasta) {
    sql += ' AND fecha <= ?';
    params.push(fechaHasta);
  }
  
  // Si hay orden especificado, agregar ORDER BY
  if (orden === 'asc') {
    sql += ' ORDER BY precio ASC';  // Menor a mayor
  } else if (orden === 'desc') {
    sql += ' ORDER BY precio DESC';  // Mayor a menor
  }
  
  // Ejecutar consulta con prepared statement (previene SQL injection)
  const productos = db.prepare(sql).all(...params);
  
  // Responder con los productos en formato JSON
  res.json(productos);
});

// --------------------------------------------------------------------------
// GET /api/productos/:id
// Obtener un producto específico por su ID
// --------------------------------------------------------------------------
app.get('/api/productos/:id', (req, res) => {
  // req.params.id contiene el ID de la URL
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  
  if (producto) {
    res.json(producto);
  } else {
    res.status(404).json({ error: 'Producto no encontrado' });
  }
});

// --------------------------------------------------------------------------
// POST /api/pedidos
// Crear un nuevo pedido (checkout)
// FIX IDOR: precio validado desde la BD, no del cliente (price manipulation)
// FIX DoS: rate limiter de checkout (máx 10/IP/min)
// --------------------------------------------------------------------------
app.post('/api/pedidos', checkoutRateLimiter, (req, res) => {
  const { cliente, email, direccion, items } = req.body;

  if (!cliente || !email || !direccion || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  // FIX: obtener precios reales de la BD — ignorar el precio enviado por el cliente
  let total = 0;
  const itemsValidados = [];
  for (const item of items) {
    const producto = db.prepare('SELECT id, precio FROM productos WHERE id = ?').get(item.id);
    if (!producto) {
      return res.status(400).json({ error: 'Uno o más artículos no están disponibles' });
    }
    const cantidad = parseInt(item.cantidad);
    if (!cantidad || cantidad < 1) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }
    total += producto.precio * cantidad;
    itemsValidados.push({ id: producto.id, precio: producto.precio, cantidad });
  }

  const result = db.prepare('INSERT INTO pedidos (cliente, email, direccion, total) VALUES (?, ?, ?, ?)').run(cliente, email, direccion, total);
  const pedidoId = result.lastInsertRowid;

  const insertItem = db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)');
  for (const item of itemsValidados) {
    insertItem.run(pedidoId, item.id, item.cantidad, item.precio);
  }

  res.json({ id: pedidoId, mensaje: 'Pedido creado correctamente' });
});

// --------------------------------------------------------------------------
// GET /api/pedidos
// FIX Broken Access Control + IDOR: requiere autenticación Y rol admin
// --------------------------------------------------------------------------
app.get('/api/pedidos', authenticate, requireAdmin, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos ORDER BY fecha DESC').all();
  res.json(pedidos);
});

// --------------------------------------------------------------------------
// GET /api/pedidos/:id
// FIX IDOR: requiere autenticación Y rol admin.
// --------------------------------------------------------------------------
app.get('/api/pedidos/:id', authenticate, requireAdmin, (req, res) => {
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);

  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }

  const items = db.prepare(`
    SELECT pi.*, p.nombre, p.imagen
    FROM pedido_items pi
    JOIN productos p ON pi.producto_id = p.id
    WHERE pi.pedido_id = ?
  `).all(req.params.id);

  res.json({ ...pedido, items });
});

// --------------------------------------------------------------------------
// POST /api/productos
// FIX Broken Access Control: requiere autenticación y rol admin
// --------------------------------------------------------------------------
app.post('/api/productos', authenticate, requireAdmin, (req, res) => {
  // Extraer datos del body
  const { nombre, descripcion, precio, imagen, categoria } = req.body;
  
  // Validar datos requeridos
  if (!nombre || !precio) {
    return res.status(400).json({ error: 'Nombre y precio son requeridos' });
  }

  // Insertar producto
  const stmt = db.prepare('INSERT INTO productos (nombre, descripcion, precio, imagen, categoria) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(nombre, descripcion || '', precio, imagen || '', categoria || '');
  
  // Responder con el ID del producto creado
  res.json({ id: result.lastInsertRowid, mensaje: 'Producto creado' });
});

// --------------------------------------------------------------------------
// PUT /api/productos/:id
// FIX Broken Access Control: requiere autenticación y rol admin
// --------------------------------------------------------------------------
app.put('/api/productos/:id', authenticate, requireAdmin, (req, res) => {
  const { nombre, descripcion, precio, imagen, categoria } = req.body;
  
  // Actualizar el producto
  const stmt = db.prepare('UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, imagen = ?, categoria = ? WHERE id = ?');
  const result = stmt.run(nombre, descripcion, precio, imagen, categoria, req.params.id);
  
  // Verificar si se actualizó algo
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  
  res.json({ mensaje: 'Producto actualizado' });
});

// --------------------------------------------------------------------------
// DELETE /api/productos/:id
// FIX Broken Access Control: requiere autenticación y rol admin
// --------------------------------------------------------------------------
app.delete('/api/productos/:id', authenticate, requireAdmin, (req, res) => {
  const stmt = db.prepare('DELETE FROM productos WHERE id = ?');
  const result = stmt.run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  
  res.json({ mensaje: 'Producto eliminado' });
});

// --------------------------------------------------------------------------
// POST /api/login
// Autenticar usuario (devuelve token de sesión)
// --------------------------------------------------------------------------
app.post('/api/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);

  let passwordValida = false;
  if (user) {
    try {
      passwordValida = await argon2.verify(user.password, password);
    } catch {
      // Hash no reconocido (formato antiguo no migrado) → login inválido
      passwordValida = false;
    }
  }

  if (!user || !passwordValida) {
    recordFailedLogin(ip);
    // FIX Information Exposure: no revelar intentos restantes al atacante
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
});

// --------------------------------------------------------------------------
// POST /api/logout
// Cerrar sesión
// --------------------------------------------------------------------------
app.post('/api/logout', (req, res) => {
  const token = req.headers.authorization;
  if (token && sessions[token]) {
    delete sessions[token];
  }
  res.json({ message: 'Sesión cerrada' });
});

// --------------------------------------------------------------------------
// GET /api/usuario
// Obtener datos del usuario autenticado
// --------------------------------------------------------------------------
app.get('/api/usuario', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// --------------------------------------------------------------------------
// POST /api/usuario/avatar
// Subir imagen de perfil de usuario
// --------------------------------------------------------------------------
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const avatarDir = path.join(__dirname, 'avatars');
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir);
      }
      cb(null, avatarDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
  }
});

app.post('/api/usuario/avatar', authenticate, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha proporcionado ninguna imagen' });
  }

  const avatarUrl = `/avatars/${req.file.filename}`;
  db.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').run(avatarUrl, req.user.id);
  
  req.user.avatar = avatarUrl;
  sessions[req.headers.authorization].avatar = avatarUrl;

  res.json({ success: true, avatar: avatarUrl, message: 'Avatar actualizado' });
});

// --------------------------------------------------------------------------
// GET /api/admin/pedidos
// Obtener todos los pedidos (solo admin)
// --------------------------------------------------------------------------
app.get('/api/admin/pedidos', authenticate, requireAdmin, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos ORDER BY fecha DESC').all();
  res.json(pedidos);
});

// --------------------------------------------------------------------------
// DELETE /api/admin/pedidos/:id
// Eliminar un pedido (solo admin)
// --------------------------------------------------------------------------
app.delete('/api/admin/pedidos/:id', authenticate, requireAdmin, (req, res) => {
  const stmt = db.prepare('DELETE FROM pedidos WHERE id = ?');
  const result = stmt.run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  
  res.json({ mensaje: 'Pedido eliminado' });
});

// =================================================================
// INICIAR SERVIDOR (async: espera a que argon2 hashee los seeds)
// =================================================================
(async () => {
  await initUsuarios();
  app.listen(PORT, () => {
    console.log(`Backend corriendo en http://localhost:${PORT}`);
  });
})();
