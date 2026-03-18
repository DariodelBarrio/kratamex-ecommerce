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
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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

app.use(cors());
app.use(express.json());
app.use(logRequest);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    categoria TEXT                          -- Categoría del producto
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
`);

// =================================================================
// DATOS DE EJEMPLO (SEED)
// =================================================================
// Si no hay productos en la base de datos, agregar algunos de ejemplo
const productosExistentes = db.prepare('SELECT COUNT(*) as count FROM productos').get();
if (productosExistentes.count === 0) {
  // Preparar la consulta SQL para insertar productos
  const insert = db.prepare('INSERT INTO productos (nombre, descripcion, precio, imagen, categoria) VALUES (?, ?, ?, ?, ?)');
  
  // Lista de productos de ejemplo
  const productos = [
    ['Laptop Pro 15"', 'Potente laptop con procesador Intel i7, 16GB RAM, 512GB SSD', 1299.99, 'https://picsum.photos/seed/laptop/400/300', 'Electrónica'],
    ['Smartphone Ultra', 'Teléfono inteligente con pantalla OLED 6.7", 128GB almacenamiento', 899.99, 'https://picsum.photos/seed/phone/400/300', 'Electrónica'],
    ['Auriculares Bluetooth', 'Auriculares inalámbricos con cancelación de ruido', 199.99, 'https://picsum.photos/seed/headphones/400/300', 'Audio'],
    ['Smartwatch Sport', 'Reloj inteligente resistente al agua con GPS', 349.99, 'https://picsum.photos/seed/watch/400/300', 'Wearables'],
    ['Cámara Digital 4K', 'Cámara profesional con sensor de 24MP', 799.99, 'https://picsum.photos/seed/camera/400/300', 'Cámaras'],
    ['Tablet 10"', 'Tablet con pantalla retina, 64GB almacenamiento', 449.99, 'https://picsum.photos/seed/tablet/400/300', 'Electrónica'],
    ['Consola de Juegos', 'Consola de próxima generación con 1TB SSD', 499.99, 'https://picsum.photos/seed/console/400/300', 'Gaming'],
    ['Altavoz Inteligente', 'Altavoz con asistente de voz integrado', 129.99, 'https://picsum.photos/seed/speaker/400/300', 'Audio']
  ];

  // Insertar cada producto
  for (const p of productos) {
    insert.run(...p);
  }
  console.log('Productos de ejemplo insertados');
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
//   - orden: 'asc' o 'desc' para ordenar por precio
// --------------------------------------------------------------------------
app.get('/api/productos', (req, res) => {
  // Obtener parámetros de la URL (query string)
  const { busqueda, categoria, orden, desde, hasta } = req.query;
  
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
// Body (JSON):
//   - cliente: nombre del cliente
//   - email: correo del cliente
//   - direccion: dirección de envío
//   - items: array de productos [{id, cantidad, precio}, ...]
// --------------------------------------------------------------------------
app.post('/api/pedidos', (req, res) => {
  // Extraer datos del body de la petición
  const { cliente, email, direccion, items } = req.body;
  
  // Validar que estén todos los datos requeridos
  if (!cliente || !email || !direccion || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  // Calcular el total de la compra
  const total = items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  // Insertar el pedido en la tabla de pedidos
  const insertPedido = db.prepare('INSERT INTO pedidos (cliente, email, direccion, total) VALUES (?, ?, ?, ?)');
  const result = insertPedido.run(cliente, email, direccion, total);
  const pedidoId = result.lastInsertRowid;  // Obtener el ID del pedido creado

  // Insertar cada producto del pedido
  const insertItem = db.prepare('INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio) VALUES (?, ?, ?, ?)');
  
  for (const item of items) {
    insertItem.run(pedidoId, item.id, item.cantidad, item.precio);
  }

  // Responder con éxito
  res.json({ id: pedidoId, mensaje: 'Pedido creado correctamente' });
});

// --------------------------------------------------------------------------
// GET /api/pedidos
// Obtener todos los pedidos (para el admin)
// --------------------------------------------------------------------------
app.get('/api/pedidos', (req, res) => {
  // Obtener todos los pedidos ordenados por fecha (más recientes primero)
  const pedidos = db.prepare('SELECT * FROM pedidos ORDER BY fecha DESC').all();
  res.json(pedidos);
});

// --------------------------------------------------------------------------
// GET /api/pedidos/:id
// Obtener un pedido específico con sus items
// --------------------------------------------------------------------------
app.get('/api/pedidos/:id', (req, res) => {
  // Buscar el pedido
  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(req.params.id);
  
  if (!pedido) {
    return res.status(404).json({ error: 'Pedido no encontrado' });
  }
  
  // Obtener los items del pedido (uniendo con la tabla de productos)
  const items = db.prepare(`
    SELECT pi.*, p.nombre, p.imagen 
    FROM pedido_items pi 
    JOIN productos p ON pi.producto_id = p.id 
    WHERE pi.pedido_id = ?
  `).all(req.params.id);
  
  // Responder con el pedido y sus items
  res.json({ ...pedido, items });
});

// --------------------------------------------------------------------------
// POST /api/productos
// Crear un nuevo producto
// --------------------------------------------------------------------------
app.post('/api/productos', (req, res) => {
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
// Actualizar un producto existente
// --------------------------------------------------------------------------
app.put('/api/productos/:id', (req, res) => {
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
// Eliminar un producto
// --------------------------------------------------------------------------
app.delete('/api/productos/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM productos WHERE id = ?');
  const result = stmt.run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Producto no encontrado' });
  }
  
  res.json({ mensaje: 'Producto eliminado' });
});

// --------------------------------------------------------------------------
// POST /api/login
// Autenticar al administrador
// --------------------------------------------------------------------------
// TODO: Usar variables de entorno para la contraseña en un entorno de producción
const ADMIN_PASSWORD = 'admin123';

app.post('/api/login', (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'La contraseña es requerida' });
  }

  if (password === ADMIN_PASSWORD) {
    // En una aplicación real, aquí se generaría un token (JWT)
    res.json({ success: true, message: 'Inicio de sesión correcto' });
  } else {
    res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
  }
});

// =================================================================
// INICIAR SERVIDOR
// =================================================================
// Escuchar en el puerto configurado
app.listen(PORT, () => {
  console.log(`Backend corriendo en http://localhost:${PORT}`);
});
