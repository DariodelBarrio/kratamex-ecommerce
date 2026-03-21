# Documentación Completa — Tienda Online KRATAMEX

## Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Frontend — React + TypeScript](#frontend--react--typescript)
4. [Backend — Node.js + Hono](#backend--nodejs--hono)
5. [Base de Datos — PostgreSQL](#base-de-datos--postgresql)
6. [API REST](#api-rest)
7. [Panel SOC — Ciberseguridad](#panel-soc--ciberseguridad)
8. [Autenticación y Seguridad](#autenticación-y-seguridad)
9. [Despliegue y Docker](#despliegue-y-docker)
10. [Guía de Desarrollo](#guía-de-desarrollo)

---

## Visión General

KRATAMEX es una **tienda online completa** de ordenadores y accesorios construida con React 19 + Hono + PostgreSQL. Incluye catálogo con filtros, carrito de compra, checkout, historial de pedidos, perfil de usuario, panel de administración completo y un **panel de operaciones de ciberseguridad (SOC)** para monitorizar la actividad en tiempo real.

### Características Principales

- **Catálogo**: Búsqueda full-text, filtros por categoría, ordenamiento por precio
- **Experiencia visual**: Splash screen, partículas animadas, modo oscuro/claro, efecto 3D tilt en tarjetas
- **Carrito**: Agregar, modificar cantidad, eliminar, cupones, cálculo de IVA (21%), envío gratis
- **Checkout**: Formulario validado por Zod + validación server-side de precios
- **Perfil de usuario**: Avatar editable (Cloudinary o local), nombre, email, dirección, teléfono, idioma (es/en)
- **Historial de pedidos**: Lista con expand/collapse de items por pedido, estado con badge de color
- **Panel Admin** (`/admin`): Dashboard con métricas y gráficas, CRUD de productos con subida de imagen, gestión de pedidos, gestión de reseñas
- **Panel SOC** (`/panel`): Centro de operaciones de ciberseguridad con métricas en tiempo real, gráficas, log de eventos filtrable, auto-refresh cada 15 s
- **Autenticación RBAC**: Roles `admin` y `standard`, tokens de sesión criptográficos (256 bits, TTL 8h)
- **Seguridad**: argon2id, rate limiting, Drizzle ORM (queries parametrizadas), Zod, HTTPS, CORS, security headers
- **Docker**: 4 servicios (frontend, backend, postgres, nginx) con hot-reload

### Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript | 19.x |
| Server State | TanStack Query | 5.x |
| Animaciones | Framer Motion | latest |
| Build Tool | Vite | 8.x |
| Iconos | Lucide React | latest |
| Gráficas | Recharts | 3.x |
| Routing | React Router | 6.x |
| Validación cliente | Zod | 3.x |
| Backend | Hono + Node.js | 4.x |
| ORM | Drizzle ORM | 0.44.x |
| Validación servidor | Zod + @hono/zod-validator | 3.x |
| Base de datos | PostgreSQL | 16-alpine |
| Driver DB | pg (node-postgres) | 8.x |
| Hashing | argon2 (argon2id) | 0.44.x |
| Imágenes CDN | Cloudinary (fallback local) | 2.x |
| Runtime TS | tsx | 4.x |
| Reverse Proxy | nginx:alpine | latest |
| Contenedores | Docker + Docker Compose | - |

---

## Arquitectura del Sistema

```
  Usuario
  http://localhost   ──►  nginx :80  ──► 301 HTTPS
  https://localhost  ──►  nginx :443 (TLS 1.2/1.3)
  http://localhost:3000 ──► Frontend directo (dev)

                           nginx :443
                           │
                ┌──────────┴──────────┐
                │                     │
         /api/* → :3001         /* → :3000
                │                     │
           Backend (Hono)      Frontend (Vite)
                │
           PostgreSQL :5432
```

### Servicios Docker

| Servicio | Imagen | Puerto | Descripción |
|---------|--------|--------|-------------|
| `frontend` | node:22-alpine | 3000 | Vite dev server con HMR |
| `backend` | node:22-alpine | 3001 | Hono API server con tsx watch |
| `postgres` | postgres:16-alpine | 5432 | Base de datos |
| `nginx` | nginx:alpine | 80, 443 | Reverse proxy + TLS |

### Flujo de red

- **HTTPS (443)**: nginx termina TLS → enruta `/api/*` al backend, el resto al frontend
- **HTTP (80)**: nginx redirige 301 → HTTPS
- **:3000 directo**: útil para desarrollo (evita el certificado autofirmado en Playwright/fetch)
- **nginx** pasa `X-Forwarded-For` y `X-Real-IP` al backend para detección de IP del cliente

---

## Frontend — React + TypeScript

### Estructura de Archivos

```
frontend/src/
├── components/
│   ├── Admin/
│   │   ├── Admin.tsx              # Panel de administración completo
│   │   └── Admin.module.css       # Estilos del panel (CSS Modules)
│   ├── SecurityDashboard.tsx      # Panel SOC de ciberseguridad
│   ├── SecurityDashboard.module.css
│   ├── OrderHistory.tsx           # Historial de pedidos del usuario
│   ├── UserProfile.tsx            # Perfil editable del usuario
│   ├── ProductCard.tsx            # Tarjeta de producto
│   ├── ProductoDetalle.tsx        # Detalle de producto + reseñas
│   ├── SkeletonCard.tsx           # Skeleton loading
│   ├── SecurityBadge.tsx          # Badge TLS en navbar
│   ├── PasswordStrength.tsx       # Barra de fuerza de contraseña
│   └── OptimizedImage.tsx         # Imagen con lazy loading y fallback
├── App.tsx                        # Tienda + rutas + navbar
├── main.tsx                       # BrowserRouter + QueryClientProvider
├── api.ts                         # fetch wrappers (getUsuario, updatePerfil…)
├── i18n.ts                        # Internacionalización (es / en)
├── index.css                      # Variables CSS dark/light mode
└── interfaces.ts                  # Tipos TypeScript
```

### Rutas React Router

```tsx
<Routes>
  <Route path="/"            element={<Tienda />} />
  <Route path="/producto/:id" element={<ProductoDetalle />} />
  <Route path="/login"       element={<Login />} />
  <Route path="/registro"    element={<Registro />} />
  <Route path="/perfil"      element={authUser ? <UserProfile /> : <Navigate to="/login" />} />
  <Route path="/mis-pedidos" element={authUser ? <OrderHistory /> : <Navigate to="/login" />} />
  <Route path="/admin"       element={<Admin />} />
  <Route path="/panel"       element={<SecurityDashboard />} />
</Routes>
```

### Componentes Principales

#### Tienda (`/`)

Página principal con catálogo, búsqueda, filtros y carrito.

```typescript
// Server state — TanStack Query (caché 30s)
const { data: productos = [], isLoading } = useQuery<Producto[]>({
  queryKey: ['productos', busqueda, categoria, orden],
  queryFn: () => fetch(`/api/productos?${params}`).then(r => r.json()),
});

// Mutación checkout
const checkout = useMutation({
  mutationFn: (data) => fetch('/api/pedidos', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  onSuccess: () => { setCarrito([]); setCheckoutExitoso(true); },
});
```

Filtros disponibles:
- Búsqueda por nombre / descripción / categoría (ILIKE en PostgreSQL)
- Categoría: Todos, Portátiles, Gaming, Sobremesa
- Precio: mínimo y máximo
- Ordenamiento: precio asc/desc
- Favoritos (localStorage)
- Vista: cuadrícula / lista

#### UserProfile (`/perfil`)

Formulario editable con TanStack Query:
- Avatar: previsualización instantánea, envío como base64
- Campos: nombre completo, email, dirección, teléfono
- Selector de idioma (es/en) — aplica `setLang()` al cambiar
- Toast de confirmación animado con Framer Motion
- Badge de rol (Admin/Usuario) con color

#### OrderHistory (`/mis-pedidos`)

Lista de pedidos del usuario autenticado:
- Skeleton loading mientras carga
- Badge de estado con colores (pendiente, confirmado, enviado, entregado, cancelado)
- Expand/collapse animado por pedido (muestra imagen, nombre, cantidad, precio de cada item)
- Empty state con icono Package si no hay pedidos

#### Admin (`/admin`)

Login propio con rol admin. Cuatro pestañas:

**Dashboard**
- KPIs: total pedidos, ingresos totales, ticket medio, clientes únicos, productos en catálogo
- AreaChart de ingresos por día
- LineChart de pedidos por día
- Tabla de compras de clientes con opción de eliminar pedido

**Productos**
- CRUD completo sin tocar código
- Formulario: nombre, descripción, precio, categoría
- Upload drag-and-drop de imagen (JPG/PNG/WEBP, máx. 5 MB) con preview
- Tabla con miniatura de imagen, categoría, precio, acciones Editar/Eliminar

**Pedidos**
- Tabla de todos los pedidos con estado, total y fecha
- Eliminación individual

**Reseñas**
- Listado de todas las valoraciones de clientes
- Muestra: avatar/inicial del usuario, nombre, producto valorado, puntuación (★★★★★), título y texto
- Botón de eliminar individual por reseña

### Design System

**Dark / Light mode**: controlado por `data-theme` en `<html>`. Variables CSS en `index.css`:

```css
[data-theme="dark"]  { --bg: #020617; --card-bg: rgba(30,41,59,.5); --accent: #059669; }
[data-theme="light"] { --bg: #f1f5f9; --card-bg: #ffffff; --accent: #059669; }
```

**Glassmorphism**:
```css
background: rgba(30, 41, 59, 0.5);
backdrop-filter: blur(20px);
border: 1px solid rgba(255,255,255,0.06);
```

**Efecto 3D tilt** en tarjetas de producto: `transform: perspective(800px) rotateX() rotateY()` calculado con el evento `mousemove`.

**Partículas animadas** en el hero: Canvas 2D con partículas que siguen el cursor y se conectan por líneas.

**Splash screen**: animación de entrada con el logo de Kratamex al cargar la aplicación.

### Internacionalización (i18n)

```typescript
// i18n.ts
export function t(key: string): string { /* ... */ }
export function setLang(lang: 'es' | 'en'): void { /* ... */ }
export function getLang(): 'es' | 'en' { /* ... */ }
```

El idioma se persiste en `localStorage` y se sincroniza con el perfil del usuario en la BD.

---

## Backend — Node.js + Hono

### Estructura de Archivos

```
backend/src/
├── index.ts           # Servidor Hono — rutas, middlewares, logger SOC, seed
├── schemas.ts         # Esquemas Zod compartidos
├── db/
│   ├── schema.ts      # Tablas Drizzle ORM con tipos TypeScript inferidos
│   └── index.ts       # Conexión Drizzle + Pool pg
├── uploads/           # Imágenes de productos (fallback local)
├── avatars/           # Avatares de usuarios (fallback local)
└── access.log         # Log de accesos HTTP
```

### Middlewares globales

```
app.use('*')  → Logger de accesos (access.log)
app.use('*')  → CORS (solo CORS_ORIGIN del .env)
app.use('*')  → Security headers (HSTS, CSP, X-Frame-Options…)
app.use('*')  → General rate limiter (60 req/min por IP)
```

### Middlewares de autenticación

```typescript
authenticate      // Verifica token en header Authorization, rechaza con 401
requireAdmin      // authenticate + comprueba role === 'admin', rechaza con 403
```

### Rate limiters específicos

| Limiter | Límite | Ventana | Ruta |
|---------|--------|---------|------|
| `loginRateLimiter` | 12 intentos → bloqueo | 60 s bloqueo | POST /api/login |
| `checkoutRateLimiter` | 10 pedidos | 60 s | POST /api/pedidos |
| `comentariosRateLimiter` | 10 comentarios | 60 s | POST /api/productos/:id/comentarios |
| `generalRateLimiter` | 60 req | 60 s | Todas las rutas |

### Logger de Eventos SOC

```typescript
async function logSecEvent(tipo: string, data: {
  ip?: string; username?: string; endpoint?: string;
  metodo?: string; userAgent?: string; detalles?: string;
}): Promise<void>
```

Se llama automáticamente en:
- `POST /api/login` → `login_ok`, `login_fail`, `brute_force`
- Middleware `authenticate` → `auth_invalid` (token no encontrado o expirado)

Los eventos se persisten en la tabla `security_events` de PostgreSQL.

### Gestión de sesiones (en memoria)

```typescript
const sessions: Record<string, Session> = {};
const SESSION_TTL = 8 * 60 * 60 * 1000;  // 8 horas

// Limpieza automática cada 15 minutos
setInterval(() => {
  for (const [token, session] of Object.entries(sessions)) {
    if (Date.now() - session.createdAt > SESSION_TTL) delete sessions[token];
  }
}, 15 * 60 * 1000);
```

### Subida de imágenes

Soporte dual: Cloudinary (prioritario) o sistema de archivos local (fallback).

```typescript
// Si CLOUDINARY_* están en .env → sube a CDN
// Si no → guarda en src/uploads/ o src/avatars/
```

Rutas afectadas: `POST /api/productos/:id/imagen`, `POST /api/usuario/avatar`

---

## Base de Datos — PostgreSQL

### Schema Drizzle ORM (`backend/src/db/schema.ts`)

```typescript
// Tablas principales
export const productos       = pgTable('productos',       { id, nombre, descripcion, precio, imagen, categoria });
export const pedidos         = pgTable('pedidos',         { id, cliente, email, direccion, total, estado, fecha });
export const pedidoItems     = pgTable('pedido_items',    { id, pedidoId, productoId, nombre, precio, cantidad, imagen });
export const usuarios        = pgTable('usuarios',        { id, username, password, email, nombre, role, avatar, direccion, telefono, idioma });
export const comentarios     = pgTable('comentarios',     { id, productoId, usuarioId, autor, titulo, contenido, valoracion, fecha });
export const securityEvents  = pgTable('security_events', { id, tipo, ip, username, endpoint, metodo, userAgent, detalles, fecha });
```

### Tipos de evento en `security_events`

| tipo | Cuándo |
|------|--------|
| `login_ok` | Login exitoso |
| `login_fail` | Credenciales incorrectas |
| `brute_force` | IP bloqueada tras ≥12 intentos fallidos |
| `auth_invalid` | Token no encontrado o sesión expirada |
| `register` | Nuevo usuario registrado |
| `forbidden` | Acceso denegado por RBAC |

### Comandos Drizzle Kit

```bash
npm run db:generate   # Genera SQL de migración desde el schema
npm run db:push       # Aplica el schema directamente a la DB (dev)
npm run db:studio     # Abre GUI visual de la DB en el navegador
```

### Seed inicial

Al arrancar, el backend crea las tablas (`CREATE TABLE IF NOT EXISTS`) y hace seed de:
- **15 productos** (6 portátiles, 6 gaming, 3 sobremesa) con imágenes de Unsplash
- **2 usuarios**: `admin` (argon2id de `admin123`) y `user` (argon2id de `user123`)
- **Reseñas de ejemplo** en varios productos

---

## API REST

### Endpoints públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/productos` | Lista productos. Query: `busqueda`, `categoria`, `orden`, `desde`, `hasta` |
| GET | `/api/productos/:id` | Producto por ID |
| GET | `/api/productos/:id/comentarios` | Reseñas del producto |
| POST | `/api/productos/:id/comentarios` | Publicar reseña (rate limited) |
| POST | `/api/pedidos` | Crear pedido con validación de precios server-side |
| POST | `/api/login` | Autenticar usuario (rate limited) |
| POST | `/api/registro` | Registrar nuevo usuario |
| POST | `/api/logout` | Cerrar sesión (invalidar token) |

### Endpoints autenticados (usuario)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/usuario` | Datos del usuario actual |
| PUT | `/api/usuario/perfil` | Actualizar perfil (nombre, email, avatar, idioma…) |
| POST | `/api/usuario/avatar` | Subir avatar |
| GET | `/api/mis-pedidos` | Pedidos del usuario autenticado con items |

### Endpoints admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/productos` | Crear producto |
| PUT | `/api/productos/:id` | Actualizar producto |
| DELETE | `/api/productos/:id` | Eliminar producto |
| POST | `/api/productos/:id/imagen` | Subir imagen del producto |
| GET | `/api/admin/pedidos` | Todos los pedidos |
| DELETE | `/api/admin/pedidos/:id` | Eliminar pedido |
| GET | `/api/admin/valoraciones` | Todas las reseñas (join producto + usuario) |
| DELETE | `/api/admin/valoraciones/:id` | Eliminar reseña |

### Endpoints SOC (admin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/security/stats` | Métricas 24h: totales por tipo, IPs únicas, sesiones activas, top IPs, actividad horaria |
| GET | `/api/security/events` | Log de eventos. Query: `tipo`, `limit` (default 100) |

### Formato de respuesta `/api/security/stats`

```json
{
  "total": 87,
  "login_fail": 57,
  "login_ok": 12,
  "brute_force": 3,
  "auth_invalid": 11,
  "unique_ips": 35,
  "active_sessions": 12,
  "top_ips": [{ "ip": "120.208.7.30", "count": 13 }],
  "hourly": [{ "hora": "2026-03-22T00:00:00Z", "tipo": "login_fail", "total": 18 }]
}
```

---

## Panel SOC — Ciberseguridad

### Acceso

Ruta: `http://localhost:3000/panel`

Login independiente del panel de admin: requiere usuario con `role = 'admin'`. El formulario tiene protección anti-autofill del navegador:

```tsx
{/* Honeypot — absorbe el autofill antes de los campos reales */}
<input type="text"     name="username" style={{ display: 'none' }} tabIndex={-1} readOnly />
<input type="password" name="password" style={{ display: 'none' }} tabIndex={-1} readOnly />

{/* Campos reales con name no estándar */}
<input name="soc-user" id="soc-user" autoComplete="off" />
<input name="soc-pass" id="soc-pass" autoComplete="off" type="password" />
```

### Componente SecurityDashboard

```typescript
// Carga datos y auto-refresca cada 15s
useEffect(() => {
  if (!authed || !autoRefresh) return;
  const id = setInterval(() => loadData(token), 15_000);
  return () => clearInterval(id);
}, [authed, autoRefresh, token, loadData]);
```

### Cálculo del nivel de amenaza

```typescript
const threatLevel =
  stats.brute_force > 0       ? 'CRÍTICO'
  : stats.login_fail > 10     ? 'ALTO'
  : stats.login_fail > 3      ? 'MEDIO'
  : 'BAJO';
```

### Simulador de ataques

```bash
node simulate_attacks.mjs [URL] [ADMIN_PASSWORD]
# Ejemplo:
node simulate_attacks.mjs http://localhost:3000 admin123
```

Secuencia de eventos generados:
1. **Login exitoso** (`login_ok`) — antes del bloqueo
2. **18 fallos de login** desde IPs aleatorias con User-Agents variados (Hydra, sqlmap, curl…)
3. **Brute force** — 13 intentos desde IP fija → dispara `brute_force`
4. **12 tokens inválidos** — accesos a rutas protegidas con tokens falsos → `auth_invalid`
5. **Escaneo de rutas** sensibles (/.env, /phpMyAdmin, /wp-admin…) — Nikto simulado
6. **Segundo brute force** desde otra IP → segundo evento `brute_force`

---

## Autenticación y Seguridad

### Flujo de autenticación

```
POST /api/login  { username, password }
  → Verifica con argon2.verify()
  → Crea token: crypto.randomBytes(32).toString('hex')
  → Guarda en sessions[token] con createdAt
  → Responde { token, user: { id, username, role, avatar } }

Petición autenticada:
  → Header: Authorization: <token>
  → middleware authenticate() busca en sessions[]
  → Comprueba TTL (8h)
  → Pone c.set('user', session)
```

### RBAC

| Acción | standard | admin |
|--------|----------|-------|
| Ver catálogo | Sí | Sí |
| Hacer pedidos | Sí | Sí |
| Ver historial propio | Sí | Sí |
| Editar perfil propio | Sí | Sí |
| Panel admin | No | Sí |
| CRUD productos | No | Sí |
| Eliminar pedidos | No | Sí |
| Gestionar reseñas | No | Sí |
| Panel SOC | No | Sí |
| Ver eventos de seguridad | No | Sí |

### Capas de seguridad

| Capa | Implementación |
|------|---------------|
| Contraseñas | argon2id — coste de tiempo/memoria configurable |
| Tokens | `crypto.randomBytes(32)` — 256 bits de entropía |
| SQL Injection | Drizzle ORM — queries parametrizadas por construcción |
| XSS Input | Zod valida y limita todos los campos de entrada |
| Rate limiting | Por IP, por endpoint, con bloqueo temporal |
| Brute force | Bloqueo de IP tras 12 fallos por 60 s + log en DB |
| HTTPS | TLS 1.2/1.3 en nginx con certificado (autofirmado en dev) |
| Headers | HSTS, X-Frame-Options: DENY, CSP, X-Content-Type-Options: nosniff |
| CORS | Solo el origen configurado en `CORS_ORIGIN` del `.env` |
| Uploads | Solo `image/*`, límite 5 MB, nombre aleatorio |
| Sesiones | TTL 8h, limpieza automática cada 15 min |
| Monitorización | Todos los eventos de seguridad → tabla `security_events` |

---

## Despliegue y Docker

### docker-compose.yml

```yaml
services:
  postgres:   image: postgres:16-alpine
  backend:    build: ./backend,  ports: [3001:3001]
  frontend:   build: ./frontend, ports: [3000:3000]
  nginx:      image: nginx:alpine, ports: [80:80, 443:443]
```

### Variables de entorno

**Raíz (`.env`)**:
```env
POSTGRES_DB=kratamex
POSTGRES_USER=kratamex
POSTGRES_PASSWORD=kratamex_pass
CORS_ORIGIN=https://localhost
```

**Backend (`backend/.env`)**:
```env
DATABASE_URL=postgresql://kratamex:kratamex_pass@postgres:5432/kratamex
CORS_ORIGIN=https://localhost
CLOUDINARY_CLOUD_NAME=   # opcional
CLOUDINARY_API_KEY=      # opcional
CLOUDINARY_API_SECRET=   # opcional
```

### Arranque

```bash
cp .env.example .env
cp backend/.env.example backend/.env

docker compose up --build -d

# Ver logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Accesos

| Servicio | URL |
|----------|-----|
| Tienda HTTPS | https://localhost |
| Tienda HTTP | http://localhost:3000 |
| API directa | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado (openssl). En producción reemplazar con Let's Encrypt.

---

## Guía de Desarrollo

### HMR en Docker / Windows

Docker sobre Windows usa NTFS. Los cambios de archivo no propagan eventos `inotify` al contenedor Linux, por lo que Vite/nodemon no detecta cambios automáticamente. Solución:

```bash
# Forzar recarga de un archivo tras editarlo en el host
docker compose exec frontend sh -c "touch /app/src/components/MiComponente.tsx"
docker compose exec backend  sh -c "touch /app/src/index.ts"
```

Alternativa para el backend:

```bash
docker compose restart backend
```

### Dependencias nuevas

```bash
# Instalar en el contenedor en ejecución (no reconstruye imagen)
docker compose exec backend npm install <paquete>
docker compose restart backend

# Reconstruir imagen completa (más lento pero más limpio)
docker compose up --build -d backend
```

### Drizzle Studio

```bash
# GUI visual de la DB (abre en http://local.drizzle.studio)
cd backend && npm run db:studio
```

### Simulador de ataques SOC

```bash
# Genera eventos de seguridad para probar el panel SOC
node simulate_attacks.mjs http://localhost:3000 admin123

# Personalizar URL si usas otro puerto
node simulate_attacks.mjs http://localhost:3001 admin123
```

### Usuarios de ejemplo

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |
| user | user123 | standard |

### Estructura de interfaces TypeScript

```typescript
// interfaces.ts
interface Producto {
  id: number; nombre: string; descripcion: string;
  precio: number; imagen: string; categoria: string;
}

interface Pedido {
  id: number; cliente: string; email: string; direccion: string;
  total: number; estado: string; fecha: string;
  items?: PedidoItem[];
}

interface PedidoItem {
  id: number; nombre: string; precio: number;
  cantidad: number; imagen: string;
}

interface Usuario {
  id: number; username: string; email: string; nombre: string;
  role: string; avatar: string | null; direccion: string;
  telefono: string; idioma: string;
}
```

### Añadir un nuevo evento SOC

En `backend/src/index.ts`:

```typescript
// Llamar a logSecEvent desde cualquier ruta o middleware
logSecEvent('forbidden', {
  ip:       getClientIP(c),
  username: c.get('user')?.username,
  endpoint: c.req.path,
  metodo:   c.req.method,
  detalles: 'Acceso a ruta de admin sin permisos'
});
```

El evento aparece automáticamente en el panel SOC en el próximo refresh (máx. 15 s).

---

*Última actualización: 22/03/2026*
