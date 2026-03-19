# Documentacion Completa - Tienda Online KRATAMEX

## Indice

1. [Vision General](#vision-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Frontend - React + TypeScript](#frontend---react--typescript)
4. [Backend - Node.js + Hono](#backend---nodejs--hono)
5. [Base de Datos - PostgreSQL](#base-de-datos---postgresql)
6. [API REST](#api-rest)
7. [Autenticacion y Seguridad](#autenticacion-y-seguridad)
8. [Despliegue y Docker](#despliegue-y-docker)
9. [Guia de Desarrollo](#guia-de-desarrollo)

---

## Vision General

KRATAMEX es una **tienda online completa** de ordenadores construida con React 19 + Hono + PostgreSQL. Permite navegar el catálogo, agregar al carrito, realizar pedidos y gestionar inventario desde un panel administrativo protegido por RBAC.

### Características Principales

- **Catálogo de Productos**: Búsqueda, filtros por categoría y ordenamiento por precio
- **Detalle de Producto**: Página con especificaciones técnicas, precio e IVA, sección de comentarios de clientes
- **Carrito de Compras**: Agregar, modificar cantidad y eliminar productos
- **Checkout**: Formulario validado por Zod + validación server-side de precios
- **Panel Administrativo**: CRUD de productos, gestión de pedidos y dashboard con gráficas (solo admin)
- **Autenticación RBAC**: Roles `admin` y `standard`, tokens de sesión criptográficos (TTL 8h)
- **Seguridad**: argon2id, rate limiting, HTTPS, Drizzle ORM (queries parametrizadas), Zod validation, CORS restringido
- **UI Moderna**: Glassmorphism, Framer Motion, skeleton loading, brand logos SVG
- **Docker**: 4 servicios (frontend, backend, postgres, nginx) con hot-reload

### Tecnologías Utilizadas

| Componente | Tecnología | Versión |
|------------|------------|---------|
| **Frontend** | React + TypeScript | 19.2.4 |
| **Server State** | TanStack Query | 5.x |
| **Validación cliente** | Zod | 3.x |
| **Animaciones** | Framer Motion | latest |
| **Build Tool** | Vite | 5.1.6 |
| **Iconos** | Lucide React | 0.577.0 |
| **Gráficas** | Recharts | 3.8.0 |
| **Routing** | React Router | 6.22.3 |
| **Backend** | Node.js + Hono | 4.x |
| **ORM** | Drizzle ORM | 0.44.x |
| **Validación servidor** | Zod + @hono/zod-validator | 3.x |
| **Base de Datos** | PostgreSQL | 16-alpine |
| **Driver DB** | pg (node-postgres) | 8.13.0 |
| **Hashing** | argon2 (argon2id) | 0.44.0 |
| **Imágenes** | Cloudinary (fallback local) | 2.x |
| **Runtime TS** | tsx | 4.x |
| **Reverse Proxy** | nginx:alpine | latest |
| **Container** | Docker + Docker Compose | - |

---

## Arquitectura del Sistema

```
                        +---------------------+
  Usuario               |       nginx          |
  http://localhost  --> |  Puerto 80 -> 301   |
  https://localhost --> |  Puerto 443 (TLS)   |
                        +----------+----------+
                                   |
                   +---------------+---------------+
                   v                               v
         +-----------------+             +-----------------+
         |    Frontend     |             |    Backend      |
         |  (React+Vite)   |             |    (Hono)       |
         |  Puerto: 3000   |             |  Puerto: 3001   |
         +-----------------+             +--------+--------+
                                                  |
                                         +--------v--------+
                                         |   PostgreSQL     |
                                         |   Puerto: 5432   |
                                         +-----------------+
```

### Flujo de red

- **HTTPS (443)**: nginx termina TLS -> enruta `/api/*` al backend, `/` al frontend
- **HTTP (80)**: nginx redirige 301 -> HTTPS
- **Puertos directos** (solo desarrollo): frontend:3000, backend:3001, postgres:5432

---

## Frontend - React + TypeScript

### Estructura de Archivos

```
frontend/
├── src/
│   ├── components/
│   │   ├── Admin/
│   │   │   ├── Admin.tsx              # Panel de administracion
│   │   │   └── Admin.module.css       # Estilos del panel (CSS Modules)
│   │   ├── ProductCard.tsx            # Tarjeta de producto con Framer Motion
│   │   ├── SkeletonCard.tsx           # Skeleton loading placeholder
│   │   ├── SecurityBadge.tsx          # Indicador TLS en header
│   │   ├── PasswordStrength.tsx       # Barra de fuerza de contrasena
│   │   └── OptimizedImage.tsx         # Imagen con lazy loading y fallback
│   ├── App.tsx              # Componente tienda principal + router
│   ├── main.tsx             # Punto de entrada con BrowserRouter
│   ├── index.css            # Estilos globales (Glassmorphism design system)
│   ├── interfaces.ts        # Interfaces TypeScript
│   └── utils.ts             # Funciones de utilidad (sanitize)
├── package.json
├── vite.config.ts           # Proxy /api, PWA, compresion
├── index.html
├── .dockerignore
└── Dockerfile
```

### Componentes Principales

#### Tienda (`/`)
Pagina principal con catalogo, busqueda, filtros y carrito.

**Estados principales** (TanStack Query gestiona carga, caché y error):
```typescript
// Server state con TanStack Query (caché 30s, retry 1, refetch on focus off)
const { data: productos = [], isLoading } = useQuery<Producto[]>({
  queryKey: ['productos', busqueda, categoriaFiltro, ordenPrecio],
  queryFn:  () => fetch(`/api/productos?${params}`).then(r => r.json()),
});

// Mutación de checkout con Zod antes de enviar
const checkoutMutation = useMutation({
  mutationFn: (data) => fetch('/api/pedidos', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  onSuccess:  () => { setCarrito([]); setCheckoutExitoso(true); },
});

// Estado local para carrito (no server state)
const [carrito, setCarrito] = useState<CarritoItem[]>([])
```

**Filtros disponibles**:
- Busqueda por nombre, descripcion o categoria (ILIKE en PostgreSQL)
- Filtro por categoria (Portatiles, Gaming, Sobremesa)
- Ordenamiento por precio asc/desc

#### ProductCard
Componente refactorizado con:
- **Deteccion de marca**: Identifica Apple, Dell, HP, Lenovo, ASUS desde el nombre del producto
- **Logo SVG**: Wordmark vectorial con colores de marca
- **Framer Motion**: Entrada escalonada (`initial -> animate`), hover con elevacion (`whileHover`)
- **Animacion add-to-cart**: Transicion de icono carrito -> check con `AnimatePresence`
- **BrandLogoSmall**: Version mini para items del carrito

#### SkeletonCard
Placeholder de carga con efecto shimmer animado. Se muestran 8 skeletons mientras los productos cargan.

#### SecurityBadge
Indicador visual "Secure" con icono Shield y punto pulsante verde. Se muestra en el header junto al logo.

#### PasswordStrength
Barra de 5 niveles que evalua en tiempo real:
- Longitud >= 8 y >= 12 caracteres
- Mayusculas + minusculas
- Numeros
- Caracteres especiales

Colores: rojo (muy debil) -> naranja -> amarillo -> verde claro -> verde (muy fuerte)

#### Admin (`/admin`)
Panel protegido por autenticacion con rol `admin`.

**Dashboard**:
- Metricas: total pedidos, ingresos, ticket medio, clientes unicos, productos en catalogo
- Grafica de ingresos por dia (AreaChart)
- Grafica de pedidos por dia (LineChart)
- Tabla de compras de clientes

**Gestion**:
- CRUD completo de productos
- Listado y eliminacion de pedidos

### UI Design System

**Glassmorphism**:
```css
.glass-card {
  background: rgba(30, 41, 59, 0.5);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

**Gradient Border** (pseudo-elemento con mask-composite):
```css
.gradient-border {
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

**Colores principales**:
- Background: `#020617` (slate-950)
- Surface: `rgba(30, 41, 59, 0.5)` (glassmorphism)
- Primary: `#059669` (emerald)
- Price: `#34d399` (emerald claro)
- Text: `#f1f5f9`

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
```

### Configuracion Vite (`vite.config.ts`)

- **Proxy**: `/api` -> `http://localhost:3001`
- **PWA**: manifest con nombre Kratamex, instalacion offline
- **Compresion**: gzip y brotli de assets estaticos
- **Puerto**: 3000
- **Hot-reload**: CHOKIDAR_USEPOLLING para WSL+Docker

---

## Backend - Node.js + Hono

### Estructura de Archivos

```
backend/
├── src/
│   ├── index.ts           # Servidor Hono (rutas, middlewares, seed) — TypeScript
│   ├── schemas.ts         # Esquemas Zod compartidos entre rutas
│   ├── db/
│   │   ├── schema.ts      # Definición de tablas Drizzle ORM con tipos inferidos
│   │   └── index.ts       # Conexión Drizzle + Pool pg
│   ├── uploads/           # Imágenes de productos (fallback local)
│   ├── avatars/           # Avatares de usuarios (fallback local)
│   └── access.log         # Log de peticiones
├── drizzle.config.ts      # Configuración Drizzle Kit
├── tsconfig.json          # Configuración TypeScript
├── package.json
├── .env.example
├── .dockerignore
└── Dockerfile
```

### Drizzle ORM — Schema y Queries

```typescript
// src/db/schema.ts — Tablas con tipos TypeScript inferidos
export const productos = pgTable('productos', {
  id:          serial('id').primaryKey(),
  nombre:      text('nombre').notNull(),
  precio:      real('precio').notNull(),
  // ...
});

// Tipos inferidos automáticamente
export type Producto = typeof productos.$inferSelect;
```

```typescript
// Queries type-safe con Drizzle
import { eq, and, ilike, gte, desc } from 'drizzle-orm';

// SELECT con filtros dinámicos
const rows = await db.select().from(productos)
  .where(and(ilike(productos.nombre, '%macbook%'), gte(productos.precio, 1000)))
  .orderBy(desc(productos.precio));

// INSERT con RETURNING
const [row] = await db.insert(productos)
  .values({ nombre, precio })
  .returning({ id: productos.id });

// Transacciones
const pedidoId = await db.transaction(async (tx) => {
  const [p] = await tx.insert(pedidos).values({...}).returning({ id: pedidos.id });
  await tx.insert(pedidoItems).values({...});
  return p.id;
});
```

### Validación con Zod + @hono/zod-validator

```typescript
// src/schemas.ts
export const PedidoSchema = z.object({
  cliente:   z.string().min(1).max(200),
  email:     z.string().email().max(254),
  direccion: z.string().min(1).max(500),
  items:     z.array(z.object({ id: z.number().int().positive(), cantidad: z.number().int().min(1).max(999) })).min(1).max(50),
});

// Aplicado por ruta — Hono devuelve 400 automáticamente si falla
app.post('/api/pedidos', checkoutRateLimiter, zValidator('json', PedidoSchema), async (c) => {
  const { cliente, email, direccion, items } = c.req.valid('json'); // tipado automático
  // ...
});
```

### Hono — Patrones principales

```typescript
// Middleware con contexto tipado
type Variables = { user: SessionData };
const app = new Hono<{ Variables: Variables }>();

// Middleware de autenticación
const authenticate: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const token = c.req.header('authorization');
  c.set('user', sessions[token]);
  await next();
};

// Route handler
app.get('/api/productos/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const [producto] = await db.select().from(productos).where(eq(productos.id, id));
  if (!producto) return c.json({ error: 'Producto no encontrado' }, 404);
  return c.json(producto);
});

// Arranque con @hono/node-server
serve({ fetch: app.fetch, port: 3001 }, () =>
  console.log('Backend Hono corriendo en http://localhost:3001')
);
```

### Startup con reintentos

```javascript
async function waitForDB(maxAttempts = 15, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (err) {
      console.log(`PostgreSQL: intento ${i}/${maxAttempts}...`);
      if (i === maxAttempts) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

### Seguridad implementada

- **argon2id**: Contrasenas hasheadas con argon2 (PHC winner, async)
- **Rate limiting**: 5 intentos fallidos por IP -> bloqueo 15 min en login, 10 pedidos/60s en checkout
- **Prepared statements**: Parametros `$1, $2...` con pg, prevencion de SQL injection
- **CORS restringido**: Solo `CORS_ORIGIN` de `.env` (default: `https://localhost`)
- **Tokens criptograficos**: `crypto.randomBytes(32).toString('hex')` (256 bits)
- **Validacion de uploads**: Solo jpeg/jpg/png/gif/webp, limite 5MB productos / 2MB avatares
- **RBAC**: Middleware `authenticate` + `requireAdmin` en rutas protegidas
- **HTTPS**: TLS terminado en nginx (TLSv1.2 y TLSv1.3)
- **Security headers**: HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
- **Logging**: Todas las peticiones registradas en `access.log`

---

## Base de Datos - PostgreSQL

### Tablas

#### `productos`
```sql
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  imagen TEXT,
  categoria TEXT,
  fecha TIMESTAMP DEFAULT NOW()
)
```

#### `pedidos`
```sql
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  cliente TEXT NOT NULL,
  email TEXT NOT NULL,
  direccion TEXT NOT NULL,
  total REAL NOT NULL,
  fecha TIMESTAMP DEFAULT NOW()
)
```

#### `pedido_items`
```sql
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL,
  precio REAL NOT NULL
)
```

#### `usuarios`
```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,          -- argon2id hash
  email TEXT,
  role TEXT DEFAULT 'standard' CHECK(role IN ('admin', 'standard')),
  avatar TEXT,
  created_at TIMESTAMP DEFAULT NOW()
)
```

### Seed inicial

- **15 ordenadores** de ejemplo (Portatiles, Gaming, Sobremesa)
- **3 pedidos** de ejemplo con items
- **2 usuarios** con contrasenas hasheadas con argon2id:

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |
| user | user123 | standard |

> Las contrasenas se almacenan como hashes argon2id (`$argon2id$v=19$...`), nunca en texto plano.

---

## API REST

### Endpoints de Productos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/productos` | No | Listar productos (filtros: busqueda, categoria, orden) |
| GET | `/api/productos/:id` | No | Obtener producto por ID |
| POST | `/api/productos` | Admin | Crear producto |
| PUT | `/api/productos/:id` | Admin | Actualizar producto |
| DELETE | `/api/productos/:id` | Admin | Eliminar producto |

### Endpoints de Pedidos

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/pedidos` | Admin | Listar todos los pedidos |
| GET | `/api/pedidos/:id` | Admin | Obtener pedido con items |
| POST | `/api/pedidos` | No | Crear nuevo pedido (rate limited: 10/60s) |

### Endpoints de Autenticacion

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| POST | `/api/login` | No | Autenticar (rate limited: 5 intentos/15min) |
| POST | `/api/logout` | Token | Cerrar sesion |
| GET | `/api/usuario` | Token | Datos del usuario autenticado |
| POST | `/api/usuario/avatar` | Token | Subir avatar (max 2MB) |

### Endpoints de Admin

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | `/api/admin/pedidos` | Admin | Listar pedidos |
| DELETE | `/api/admin/pedidos/:id` | Admin | Eliminar pedido |

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
  "token": "a3f8c1d2e4b5...",
  "user": { "id": 1, "username": "admin", "role": "admin" },
  "message": "Inicio de sesion correcto"
}
```

---

## Autenticacion y Seguridad

### RBAC (Role-Based Access Control)

| Accion | standard | admin |
|--------|----------|-------|
| Ver productos | Si | Si |
| Hacer pedidos | Si | Si |
| Ver perfil | Si | Si |
| Panel admin | No | Si |
| CRUD productos | No | Si |
| Eliminar pedidos | No | Si |

### Correcciones de seguridad aplicadas

| ID | Descripcion | Riesgo | Estado |
|----|-------------|--------|--------|
| ID-001 | Credenciales hardcodeadas | Critico | Corregido |
| ID-002 | Broken Access Control en admin | Alto | Corregido |
| ID-003 | SQL Injection | Medio | Corregido |
| ID-004 | Sin rate limiting en login | Medio | Corregido |
| ID-005 | Logging insuficiente | Bajo | Corregido |
| ID-006 | Validacion de uploads | Alto | Corregido |
| ID-007 | Contrasenas sin hash | Critico | Corregido |
| ID-008 | Falta de HTTPS | Critico | Corregido |
| ID-009 | XSS doble encoding | Medio | Corregido |
| ID-010 | Broken Access Control en CRUD productos | Critico | Corregido |
| ID-011 | IDOR en pedidos | Critico | Corregido |
| ID-012 | Price manipulation en checkout | Critico | Corregido |
| ID-013 | Information exposure en login | Medio | Corregido |
| ID-014 | IDOR persistente en GET /api/pedidos | Critico | Corregido |
| ID-015 | Token de sesion debil | Alto | Corregido |
| ID-016 | CORS abierto | Alto | Corregido |
| ID-017 | Enumeracion de IDs de producto | Medio | Corregido |
| ID-018 | URLs hardcodeadas bypass HTTPS | Critico | Corregido |
| ID-019 | Sin rate limiting en checkout | Alto | Corregido |
| ID-020 | nginx sin headers de seguridad | Alto | Corregido |
| ID-021 | sanitize() en URLs | Medio | Corregido |
| ID-022 | Security headers ausentes en backend Express | Alto | Corregido |
| ID-023 | Sesiones sin expiración | Crítico | Corregido |
| ID-024 | Stored XSS via descripción de producto | Alto | Corregido |
| ID-025 | Sin límite de body size | Medio | Corregido |
| ID-026 | Validación de email ausente en checkout | Medio | Corregido |
| ID-027 | Rate limiting memory leak | Medio | Corregido |
| ID-028 | File upload — nombres predecibles | Alto | Corregido |
| ID-029 | Containers Docker corriendo como root | Alto | Corregido |
| ID-030 | nginx — ciphers débiles y sin rate limiting | Alto | Corregido |
| ID-031 | Archivos de base de datos en git | Crítico | Corregido |
| ID-032 | IP spoofing en rate limiting | Medio | Corregido |
| ID-033 | Static files sin protección dotfiles | Medio | Corregido |
| ID-034 | Validaciones manuales inconsistentes | Medio | Corregido |

Ver detalle completo en `correcciones_seguridad.md`.

---

## Despliegue y Docker

### Servicios (`docker-compose.yml`)

| Servicio | Imagen | Puerto | Descripcion |
|----------|--------|--------|-------------|
| postgres | postgres:16-alpine | 5432 | Base de datos |
| backend | Node 20 Alpine | 3001 | API Express |
| frontend | Node 20 Alpine | 3000 | Vite dev server |
| nginx | nginx:alpine | 80, 443 | Reverse proxy HTTPS |

### Volumenes

| Volumen | Uso |
|---------|-----|
| `postgres_data` | Datos persistentes de PostgreSQL |
| `backend_modules` | node_modules del backend (hot-reload) |
| `frontend_modules` | node_modules del frontend (hot-reload) |
| `./backend/src` -> `/app/src` | Hot-reload backend (nodemon --legacy-watch) |
| `./frontend/src` -> `/app/src` | Hot-reload frontend (Vite HMR + polling) |

### Variables de entorno

**Raiz (`.env`)** — Usadas por Docker Compose:
```
POSTGRES_DB=kratamex
POSTGRES_USER=kratamex
POSTGRES_PASSWORD=kratamex_dev
```

**Backend (`backend/.env`)** — Usadas por la app:
```
ADMIN_USER=admin
ADMIN_PASS=admin123
DB_HOST=postgres
DB_PORT=5432
DB_NAME=kratamex
DB_USER=kratamex
DB_PASSWORD=kratamex_dev
CORS_ORIGIN=https://localhost
```

### Comandos

```bash
# Copiar variables de entorno
cp .env.example .env
cp backend/.env.example backend/.env

# Levantar todo
docker compose up --build -d

# Ver estado
docker compose ps

# Ver logs
docker compose logs -f backend

# Rebuild tras cambios en package.json
docker compose stop frontend
docker rm kratamex-frontend-1
docker volume rm kratamex_frontend_modules
docker compose up -d --build frontend

# Parar
docker compose down
```

### URLs de acceso

| Acceso | URL |
|--------|-----|
| **Web HTTPS** (recomendado) | https://localhost |
| HTTP -> redirige a HTTPS | http://localhost |
| Frontend directo | http://localhost:3000 |
| Backend API directo | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado (dev). En produccion usar Let's Encrypt.

---

## Guia de Desarrollo

### Prerrequisitos

- Node.js 20+
- Docker + Docker Compose
- Git

### Instalacion

```bash
git clone https://github.com/ddelbarriojuan-code/Proyecto_web
cd Proyecto_web

# Con Docker (recomendado)
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build -d

# Manual (requiere PostgreSQL local)
cd backend && npm install && npm start &
cd frontend && npm install && npm run dev
```

### Scripts

**Frontend**:
- `npm run dev`: Servidor de desarrollo (puerto 3000)
- `npm run build`: Build de produccion (`tsc && vite build`)
- `npm test`: Tests con Vitest

**Backend**:
- `npm start`: Inicia servidor (puerto 3001)
- `npm run dev`: Desarrollo con nodemon (polling)

---

## Estado actual del proyecto

- **Productos de ejemplo**: 15 ordenadores (Portatiles, Gaming, Sobremesa)
- **Endpoints API**: 14 rutas REST
- **Tablas DB**: 4 (PostgreSQL)
- **Correcciones de seguridad**: 21 vulnerabilidades documentadas y corregidas
- **UI**: Glassmorphism + Framer Motion + Skeleton Loading
- **Version**: 2.0.0

---

*Ultima actualizacion: 19/03/2026 -- v2.0.0*
