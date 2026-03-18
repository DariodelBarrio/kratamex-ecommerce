# Documentación Completa - Tienda Online KRATAMEX

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Frontend - React + TypeScript](#frontend---react--typescript)
4. [Backend - Node.js + Express](#backend---nodejs--express)
5. [Base de Datos - SQLite](#base-de-datos---sqlite)
6. [API REST](#api-rest)
7. [Autenticación y Seguridad](#autenticación-y-seguridad)
8. [Despliegue y Docker](#despliegue-y-docker)
9. [Guía de Desarrollo](#guía-de-desarrollo)

---

## 🎯 Visión General

KRATAMEX es una **tienda online completa** de ordenadores construida con React + Node.js + SQLite. Permite navegar el catálogo, agregar al carrito, realizar pedidos y gestionar inventario desde un panel administrativo protegido por RBAC.

### ✨ Características Principales

- **🛍️ Catálogo de Productos**: Búsqueda, filtros por categoría, precio y fecha, ordenamiento
- **🛒 Carrito de Compras**: Agregar, modificar cantidad y eliminar productos
- **💳 Checkout**: Formulario de compra con validación
- **👨‍💼 Panel Administrativo**: CRUD de productos y gestión de pedidos (solo admin)
- **🔒 Autenticación RBAC**: Roles `admin` y `standard`, tokens de sesión
- **🛡️ Seguridad**: bcrypt, rate limiting, HTTPS, prepared statements, validación de uploads
- **📱 Diseño Responsive**: Funciona en desktop y móvil
- **🐳 Docker**: Despliegue containerizado con nginx como reverse proxy HTTPS

### 🛠️ Tecnologías Utilizadas

| Componente | Tecnología | Versión |
|------------|------------|---------|
| **Frontend** | React + TypeScript | 19.2.4 |
| **Backend** | Node.js + Express | 4.18.2 |
| **Base de Datos** | SQLite + better-sqlite3 | 9.4.3 |
| **Build Tool** | Vite | 5.1.6 |
| **Icons** | Lucide React | 0.577.0 |
| **Routing** | React Router | 6.22.3 |
| **Hashing** | bcryptjs | latest |
| **Uploads** | multer | 1.4.5-lts |
| **Reverse Proxy** | nginx:alpine | latest |
| **Container** | Docker + Docker Compose | - |

---

## 🏗️ Arquitectura del Sistema

```
                        ┌─────────────────────┐
  Usuario               │       nginx          │
  http://localhost  ──► │  Puerto 80  → 301   │
  https://localhost ──► │  Puerto 443 (TLS)   │
                        └─────────┬───────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
        ┌─────────────────┐             ┌─────────────────┐
        │    Frontend     │             │    Backend      │
        │  (React+Vite)   │             │   (Express)     │
        │  Puerto: 3000   │             │  Puerto: 3001   │
        └─────────────────┘             └────────┬────────┘
                                                 │
                                        ┌────────▼────────┐
                                        │   SQLite DB     │
                                        │   tienda.db     │
                                        └─────────────────┘
```

### Flujo de red

- **HTTPS (443)**: nginx termina TLS → enruta `/api/*` al backend, `/` al frontend
- **HTTP (80)**: nginx redirige 301 → HTTPS
- **Puertos directos** (solo desarrollo): frontend:3000, backend:3001

---

## 🎨 Frontend - React + TypeScript

### Estructura de Archivos

```
frontend/
├── src/
│   ├── components/
│   │   └── Admin/
│   │       ├── Admin.tsx         # Panel de administración
│   │       └── Admin.module.css  # Estilos del panel (CSS Modules)
│   ├── App.tsx           # Componente tienda principal
│   ├── main.tsx          # Punto de entrada con React Router
│   ├── index.css         # Estilos globales
│   ├── interfaces.ts     # Interfaces TypeScript
│   └── utils.ts          # Funciones de utilidad
├── package.json
├── vite.config.ts        # Proxy /api → backend, PWA, compresión
├── index.html
├── .dockerignore
└── Dockerfile
```

### Componentes Principales

#### 🏪 Tienda (`/`)
Página principal con catálogo, búsqueda, filtros y carrito.

**Estados principales**:
```typescript
const [productos, setProductos] = useState<Producto[]>([])
const [carrito, setCarrito] = useState<CarritoItem[]>([])
const [busqueda, setBusqueda] = useState('')
const [categoriaFiltro, setCategoriaFiltro] = useState('')
const [ordenPrecio, setOrdenPrecio] = useState<'asc' | 'desc' | ''>('')
const [loading, setLoading] = useState(true)
```

**Filtros disponibles**:
- Búsqueda por nombre, descripción o categoría
- Filtro por categoría (Portátiles, Gaming, Sobremesa)
- Filtro por rango de precio (desde/hasta)
- Filtro por rango de fecha
- Ordenamiento por precio asc/desc

#### 👨‍💼 Admin (`/admin`)
Panel protegido por autenticación. Solo accesible con rol `admin`.

**Funcionalidades**:
- Estadísticas (productos, pedidos, total ventas)
- CRUD completo de productos con subida de imagen
- Listado de pedidos con opción de eliminar
- Gestión de perfil con avatar

### Interfaces TypeScript

```typescript
interface Producto {
  id: number
  nombre: string
  descripcion: string
  precio: number
  imagen: string
  categoria: string
}

interface CarritoItem extends Producto {
  cantidad: number
}

interface Pedido {
  id: number
  cliente: string
  email: string
  direccion: string
  total: number
  fecha: string
  items?: PedidoItem[]
}
```

### Configuración Vite (`vite.config.ts`)

- **Proxy**: `/api` → `VITE_BACKEND_URL` (env var) o `http://localhost:3001` en local
- **PWA**: manifest con nombre Kratamex, iconos e instalación offline
- **Compresión**: gzip y brotli de assets estáticos
- **Puerto**: 3000

---

## 🚀 Backend - Node.js + Express

### Estructura de Archivos

```
backend/
├── src/
│   ├── index.js          # Servidor principal
│   ├── uploads/          # Imágenes de productos (generado en runtime)
│   ├── avatars/          # Avatares de usuarios (generado en runtime)
│   └── access.log        # Log de peticiones y eventos de seguridad
├── package.json
├── .dockerignore
└── Dockerfile
```

### Middlewares Globales

```javascript
app.use(cors())
app.use(express.json())
app.use(logRequest)           // Logger a access.log
app.use('/uploads', static)   // Imágenes de productos
app.use('/avatars', static)   // Avatares de usuarios
```

### Seguridad implementada

- **Rate limiting**: 5 intentos fallidos por IP → bloqueo 15 min en `/api/login`
- **bcrypt**: Contraseñas hasheadas con 10 rondas (bcryptjs)
- **Prepared statements**: Prevención de SQL injection en todas las queries
- **Validación de uploads**: Solo jpeg/jpg/png/gif/webp, límite 5MB productos / 2MB avatares
- **RBAC**: Middleware `authenticate` + `requireAdmin` en rutas protegidas
- **HTTPS**: TLS terminado en nginx (TLSv1.2 y TLSv1.3)
- **Logging**: Todas las peticiones y bloqueos de rate limit registrados en `access.log`

---

## 🗄️ Base de Datos - SQLite

### Tablas

#### `productos`
```sql
CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  imagen TEXT,
  categoria TEXT,
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
)
```

#### `pedidos`
```sql
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL,
  email TEXT NOT NULL,
  direccion TEXT NOT NULL,
  total REAL NOT NULL,
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
)
```

#### `pedido_items`
```sql
CREATE TABLE pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio REAL NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
)
```

#### `usuarios`
```sql
CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,        -- bcrypt hash
  email TEXT,
  role TEXT DEFAULT 'standard' CHECK(role IN ('admin', 'standard')),
  avatar TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

### Seed inicial

- **15 ordenadores** de ejemplo (Portátiles, Gaming, Sobremesa)
- **3 pedidos** de ejemplo
- **2 usuarios** con contraseñas hasheadas con bcrypt:

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |
| user | user123 | standard |

> Las contraseñas en la BD se almacenan como hashes bcrypt (`$2b$10$...`), nunca en texto plano.

---

## 📡 API REST

### Endpoints de Productos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/productos` | Listar productos (filtros: busqueda, categoria, desde, hasta, fechaDesde, fechaHasta, orden) |
| GET | `/api/productos/:id` | Obtener producto por ID |
| POST | `/api/productos` | Crear producto |
| PUT | `/api/productos/:id` | Actualizar producto |
| DELETE | `/api/productos/:id` | Eliminar producto |

### Endpoints de Pedidos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/pedidos` | Listar todos los pedidos |
| GET | `/api/pedidos/:id` | Obtener pedido con items |
| POST | `/api/pedidos` | Crear nuevo pedido (checkout) |

### Endpoints de Autenticación

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/login` | No | Autenticar (rate limited: 5 intentos/15min) |
| POST | `/api/logout` | Token | Cerrar sesión |
| GET | `/api/usuario` | Token | Datos del usuario autenticado |
| POST | `/api/usuario/avatar` | Token | Subir avatar (max 2MB) |

### Endpoints de Admin

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/admin/pedidos` | Token + Admin | Listar pedidos |
| DELETE | `/api/admin/pedidos/:id` | Token + Admin | Eliminar pedido |

### Ejemplo: Login

**Request**:
```json
POST /api/login
{ "username": "admin", "password": "admin123" }
```

**Response OK**:
```json
{
  "success": true,
  "token": "token_1234567890_abc123",
  "user": { "id": 1, "username": "admin", "role": "admin", "avatar": null },
  "message": "Inicio de sesión correcto"
}
```

**Response bloqueado (429)**:
```json
{ "error": "Demasiados intentos fallidos. Intenta de nuevo en 847 segundos." }
```

---

## 🔐 Autenticación y Seguridad

### RBAC (Role-Based Access Control)

Dos roles con distintos permisos:

| Acción | standard | admin |
|--------|----------|-------|
| Ver productos | ✅ | ✅ |
| Hacer pedidos | ✅ | ✅ |
| Ver perfil | ✅ | ✅ |
| Panel admin | ❌ | ✅ |
| Eliminar pedidos | ❌ | ✅ |

### Flujo de autenticación

1. `POST /api/login` → devuelve token de sesión
2. Incluir `Authorization: <token>` en peticiones protegidas
3. `POST /api/logout` → invalida el token

### Correcciones de seguridad aplicadas

| ID | Descripción | Estado |
|----|-------------|--------|
| ID-001 | Credenciales hardcodeadas | ✅ Corregido |
| ID-002 | Broken Access Control | ✅ Corregido |
| ID-003 | SQL Injection | ✅ Corregido |
| ID-004 | Sin rate limiting en login | ✅ Corregido |
| ID-005 | Logging insuficiente | ✅ Corregido |
| ID-006 | Validación de uploads | ✅ Corregido |
| ID-007 | Contraseñas sin hash | ✅ Corregido |
| ID-008 | Falta de HTTPS | ✅ Corregido |

---

## 🐳 Despliegue y Docker

### Servicios (`docker-compose.yml`)

```yaml
services:
  backend:   # Express API en puerto 3001
  frontend:  # Vite dev server en puerto 3000
  nginx:     # Reverse proxy HTTPS en puertos 80 y 443
```

### URLs de acceso

| Acceso | URL |
|--------|-----|
| **Web HTTPS** (recomendado) | https://localhost |
| HTTP → redirige a HTTPS | http://localhost |
| Frontend directo | http://localhost:3000 |
| Backend API directo | http://localhost:3001 |

> El certificado SSL es autofirmado (dev). En producción usar Let's Encrypt u otro CA válido.

### nginx (`nginx/nginx.conf`)

- Puerto 80: redirección 301 → HTTPS
- Puerto 443: TLS con TLSv1.2 y TLSv1.3
- `/api/*` → backend:3001
- `/` → frontend:3000

### Comandos

```bash
# Levantar todo
docker compose up --build -d

# Ver estado
docker compose ps

# Ver logs
docker compose logs -f backend

# Parar
docker compose down
```

### Volúmenes montados

- `./backend/src` → `/app/src` (hot reload backend)
- `./backend/tienda.db` → `/app/tienda.db` (persistencia BD)
- `./frontend/src` → `/app/src` (hot reload frontend)
- `./nginx/nginx.conf` y `./nginx/certs/` → nginx (solo lectura)

---

## 🛠️ Guía de Desarrollo

### Prerrequisitos

- Node.js 20+
- Docker + Docker Compose
- Git

### Instalación y ejecución

```bash
# Clonar
git clone https://github.com/ddelbarriojuan-code/Proyecto_web
cd Proyecto_web

# Con Docker (recomendado)
docker compose up --build -d

# Manual
cd backend && npm install && npm start &
cd frontend && npm install && npm run dev
```

### Scripts

**Frontend**:
- `npm run dev`: Servidor de desarrollo (puerto 3000)
- `npm run build`: Build de producción
- `npm test`: Tests con Vitest

**Backend**:
- `npm start`: Inicia servidor (puerto 3001)

---

## 📊 Estado actual del proyecto

- **Productos de ejemplo**: 15 ordenadores (Portátiles, Gaming, Sobremesa)
- **Endpoints API**: 14 rutas REST
- **Tablas DB**: 4 (productos, pedidos, pedido_items, usuarios)
- **Correcciones de seguridad**: 8 vulnerabilidades corregidas
- **Versión**: 1.1.0

---

## 🔄 Flujo de la Aplicación

1. Usuario accede a **https://localhost** → nginx sirve el frontend
2. Frontend carga productos desde `/api/productos`
3. Usuario filtra/busca → nueva llamada a la API con parámetros
4. Usuario añade al carrito → estado local React
5. Checkout → `POST /api/pedidos`
6. Admin hace login → `POST /api/login` → token de sesión
7. Admin gestiona productos/pedidos desde `/admin` usando endpoints protegidos

---

*Última actualización: 19/03/2026 — v1.1.0*
