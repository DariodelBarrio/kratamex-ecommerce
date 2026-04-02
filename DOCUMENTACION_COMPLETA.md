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
10. [Tests y CI/CD](#tests-y-cicd)
11. [Guía de Desarrollo](#guía-de-desarrollo)

---

## Visión General

KRATAMEX es una **tienda online completa** de ordenadores y accesorios construida con React 19 + Hono + PostgreSQL. Incluye catálogo con filtros, carrito de compra, checkout, historial de pedidos, perfil de usuario con cambio de contraseña, panel de administración completo y un **panel de operaciones de ciberseguridad (SOC)** para monitorizar la actividad en tiempo real.

### Características Principales

- **Catálogo**: Búsqueda full-text, filtros por categoría/precio/stock, ordenamiento, vista cuadrícula/lista
- **Búsquedas recientes**: historial de búsquedas guardado en localStorage con dropdown al hacer foco
- **Experiencia visual**: Splash screen, partículas animadas, modo oscuro/claro, efecto 3D tilt en tarjetas
- **ChatBot flotante**: Asistente de soporte con respuestas automáticas sobre envíos, devoluciones, pagos y búsqueda de productos. Botón FAB en esquina inferior derecha, panel de mensajes con typing indicator y sugerencias rápidas
- **Menú de usuario**: Dropdown con avatar (inicial del nombre), nombre de usuario, accesos a perfil y pedidos, y botón de logout
- **Carrito**: Agregar, modificar cantidad (input editable), eliminar, cupones de descuento, cálculo de IVA (21%), envío gratis a partir de €100
- **Checkout directo**: Formulario validado por Zod → POST `/api/pedidos` → redirige a `/mis-pedidos`
- **Perfil de usuario**: Avatar editable (Cloudinary o local), nombre, email, dirección, teléfono, idioma (es/en), **cambio de contraseña** con verificación de la actual
- **Historial de pedidos**: Lista con expand/collapse de items por pedido, estado con badge de color
- **Panel Admin** (`/admin`): Dashboard con métricas y gráficas, CRUD de productos (con stock y visibilidad), gestión de pedidos con cambio de estado inline, gestión de reseñas, CRUD de cupones, listado de usuarios, exportación CSV, **registro de auditoría** de acciones administrativas
- **Panel SOC** (`/panel`): Centro de operaciones de ciberseguridad con métricas en tiempo real, gráficas, log de eventos filtrable, auto-refresh cada 15 s
- **Autenticación RBAC**: Roles `admin` y `standard`, tokens de sesión criptográficos (256 bits, TTL 8h), **2FA TOTP** (Google Authenticator)
- **Seguridad**: argon2id, rate limiting, Drizzle ORM (queries parametrizadas), Zod, HTTPS, CORS, security headers
- **Docker**: 4 servicios (frontend, backend, postgres, nginx) con hot-reload
- **Página 404**: Ruta catch-all con enlace de vuelta a la tienda

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

- **HTTPS (443)**: nginx termina TLS → enruta `/api/*`, `/uploads/*` y `/avatars/*` al backend, el resto al frontend
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
│   │   ├── Admin.tsx              # Panel de administración completo (6 pestañas)
│   │   └── Admin.module.css       # Estilos del panel (CSS Modules)
│   ├── SecurityDashboard.tsx      # Panel SOC de ciberseguridad
│   ├── SecurityDashboard.module.css
│   ├── ChatBot.tsx                # Chatbot flotante de soporte (FAB + panel)
│   ├── StoreHeader.tsx            # Navbar con menú desplegable de usuario
│   ├── OrderHistory.tsx           # Historial de pedidos del usuario
│   ├── UserProfile.tsx            # Perfil editable + cambio de contraseña
│   ├── ProductCard.tsx            # Tarjeta de producto
│   ├── ProductoDetalle.tsx        # Detalle de producto + reseñas
│   ├── SkeletonCard.tsx           # Skeleton loading
│   ├── SecurityBadge.tsx          # Badge TLS en navbar
│   ├── PasswordStrength.tsx       # Barra de fuerza de contraseña
│   └── OptimizedImage.tsx         # Imagen con lazy loading y fallback
├── test/
│   ├── PasswordStrength.test.tsx  # Tests del componente PasswordStrength (4 casos)
│   └── ProductCard.test.tsx       # Tests del componente ProductCard (3 casos)
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
  <Route path="/"             element={<Tienda />} />
  <Route path="/producto/:id" element={<ProductoDetalle />} />
  <Route path="/login"        element={<Auth mode="login" />} />
  <Route path="/registro"     element={<Auth mode="register" />} />
  <Route path="/perfil"       element={authUser ? <UserProfile /> : <Navigate to="/login" />} />
  <Route path="/mis-pedidos"  element={authUser ? <OrderHistory /> : <Navigate to="/login" />} />
  <Route path="/admin"        element={<Admin />} />
  <Route path="/panel"        element={<SecurityDashboard />} />
  <Route path="*"             element={<Pagina404 />} />
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

// Checkout directo — useMutation + postPedido
const checkoutMutation = useMutation({
  mutationFn: () => api.postPedido({ ...formulario, items, cupon }),
  onSuccess: () => { vaciarCarrito(); navigate('/mis-pedidos'); },
});
```

Filtros disponibles:
- Búsqueda por nombre / descripción / categoría (ILIKE en PostgreSQL)
- Categoría: Todos, Portátiles, Gaming, Sobremesa (+ cualquier categoría dinámica)
- Precio: mínimo y máximo
- Ordenamiento: precio asc/desc
- Favoritos (localStorage + sincronización servidor si está logueado)
- Vista: cuadrícula / lista

Funcionalidades adicionales:
- **Búsquedas recientes**: Al hacer foco en el buscador sin texto aparece un dropdown con el historial (últimas 6 búsquedas, guardadas en `localStorage.kratamex_searches`). Botón para limpiar historial.
- **Cantidad editable en carrito**: input numérico directo en el carrito (además de botones +/−), respeta el límite de stock.
- **Cupón de descuento**: campo en el carrito → POST `/api/cupones/validar` → descuento aplicado al total.

#### UserProfile (`/perfil`)

Formulario editable con TanStack Query:
- Avatar: previsualización instantánea, envío como base64
- Campos: nombre completo, email, dirección, teléfono
- Selector de idioma (es/en) — aplica `setLang()` al cambiar
- Toast de confirmación animado con Framer Motion
- Badge de rol (Admin/Usuario) con color
- **Cambio de contraseña**: sección separada con contraseña actual (verificada con argon2 en servidor), nueva contraseña (mín. 6 caracteres), confirmación. Toggle mostrar/ocultar contraseña.

#### OrderHistory (`/mis-pedidos`)

Lista de pedidos del usuario autenticado:
- Skeleton loading mientras carga
- Badge de estado con colores (pendiente, confirmado, enviado, entregado, cancelado)
- Expand/collapse animado por pedido (muestra imagen, nombre, cantidad, precio de cada item)
- Empty state con icono Package si no hay pedidos

#### Admin (`/admin`)

Login propio con rol admin (token guardado en `localStorage` para persistir entre recargas). Siete pestañas:

**Dashboard**
- KPIs: total pedidos, ingresos totales, ticket medio, clientes únicos, productos en catálogo
- AreaChart de ingresos por día (Recharts)
- LineChart de pedidos por día
- Tabla "Top productos más vendidos" (nombre, unidades vendidas, ingresos)
- Alerta "Stock bajo (≤5 unidades)" con listado de productos afectados
- Botones de exportación CSV (pedidos y productos)

**Productos**
- CRUD completo sin tocar código
- Formulario: nombre, descripción, precio, categoría, SKU, stock inicial, destacado, activo
- Upload drag-and-drop de imagen (JPG/PNG/WEBP, máx. 5 MB) con preview
- Tabla con miniatura, categoría, precio, stock (badge de color), estado activo/oculto, acciones
- **Stock inline**: clic en el badge de stock → input → Enter/blur guarda vía `PATCH /api/productos/:id/stock`
- **Toggle visibilidad**: botón "Activo / Oculto" por producto (productos ocultos aparecen con opacidad reducida)
- Badge de stock: 🟢 verde (>10), 🟡 naranja (≤5), 🔴 rojo (0 / Agotado)

**Pedidos**
- Tabla de todos los pedidos con cliente, email, total, estado y fecha
- **Cambio de estado inline**: clic en el badge de estado → select con todos los estados posibles → guarda vía `PATCH /api/pedidos/:id/estado`
- Eliminación individual
- Botón exportar CSV

**Reseñas**
- Listado de todas las valoraciones de clientes
- Muestra: inicial del usuario, nombre, producto valorado, puntuación (★★★★★), título y texto
- Botón de eliminar individual por reseña

**Cupones**
- Formulario para crear cupones: código, tipo (porcentaje / importe fijo), valor, compra mínima, usos máximos, fecha inicio, fecha fin, activo
- Tabla con todos los cupones: código, tipo, valor, usos actuales / máximos, estado (activo/inactivo)
- Botón eliminar por cupón

**Usuarios**
- Tabla de todos los usuarios registrados
- Muestra: ID, username, nombre, email, rol (badge de color), total de pedidos, fecha de registro

**Auditoría**
- Registro inmutable de todas las acciones administrativas
- Carga lazy (solo al abrir la pestaña) vía `GET /api/admin/audit-log`
- Tabla con: Fecha, Admin, Acción (badge de color), Entidad, ID afectado, Detalles
- Badges por acción: 🟢 crear, 🔵 actualizar, 🔴 eliminar, 🟠 cambio\_estado
- Botón "Actualizar" para refrescar manualmente
- Acciones registradas: productos (CRUD), pedidos (estado + eliminar), categorías (CRUD), cupones (crear/eliminar), valoraciones (eliminar)

### Design System

**Dark / Light mode**: controlado por `data-tema` en `<html>`. Variables CSS en `index.css`:

```css
[data-tema="dark"]  { --bg: #020617; --card-bg: rgba(30,41,59,.5); --accent: #059669; }
[data-tema="light"] { --bg: #f1f5f9; --card-bg: #ffffff; --accent: #059669; }
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
backend/
├── src/
│   ├── __tests__/
│   │   ├── api.test.ts        # Tests de integración API (DB mockeada)
│   │   ├── security.test.ts   # Tests de seguridad y rate limiting
│   │   └── schemas.test.ts    # Tests de validación Zod
│   ├── index.ts           # Servidor Hono — rutas, middlewares, logger SOC, seed
│   ├── schemas.ts         # Esquemas Zod compartidos
│   ├── db/
│   │   ├── schema.ts      # Tablas Drizzle ORM con tipos TypeScript inferidos
│   │   └── index.ts       # Conexión Drizzle + Pool pg
│   ├── uploads/           # Imágenes de productos (fallback local)
│   ├── avatars/           # Avatares de usuarios (fallback local)
│   └── access.log         # Log de accesos HTTP
└── vitest.config.ts       # Configuración Vitest (entorno node, glob __tests__)
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
export const productos       = pgTable('productos',        { id, nombre, descripcion, precio, imagen, categoria, stock, sku, destacado, activo });
export const pedidos         = pgTable('pedidos',          { id, cliente, email, direccion, total, estado, notas, fecha });
export const pedidoItems     = pgTable('pedido_items',     { id, pedidoId, productoId, nombre, precio, cantidad, imagen });
export const usuarios        = pgTable('usuarios',         { id, username, password, email, nombre, role, avatar, direccion, telefono, idioma });
export const comentarios     = pgTable('comentarios',      { id, productoId, usuarioId, autor, titulo, contenido, valoracion, fecha });
export const valoraciones    = pgTable('valoraciones',     { id, productoId, usuarioId, puntuacion, titulo, comentario, fecha });
export const cupones         = pgTable('cupones',          { id, codigo, tipo, valor, minCompra, maxUsos, usos, activo, fechaInicio, fechaFin });
export const favoritos       = pgTable('favoritos',        { id, usuarioId, productoId });
export const securityEvents  = pgTable('security_events',  { id, tipo, ip, username, endpoint, metodo, userAgent, detalles, fecha });
export const auditLog        = pgTable('audit_log',        { id, adminId, adminUsername, accion, entidad, entidadId, detalles, fecha });
```

### Campos relevantes de `productos`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `stock` | integer | Unidades disponibles (0 = agotado) |
| `sku` | varchar | Referencia interna del producto |
| `destacado` | boolean | Aparece primero en el catálogo |
| `activo` | boolean | `false` = oculto en la tienda (solo visible en admin) |

### Tipos de evento en `security_events`

| tipo | Cuándo |
|------|--------|
| `login_ok` | Login exitoso |
| `login_fail` | Credenciales incorrectas |
| `brute_force` | IP bloqueada tras ≥12 intentos fallidos |
| `auth_invalid` | Token no encontrado o sesión expirada |
| `register` | Nuevo usuario registrado |
| `forbidden` | Acceso denegado por RBAC |

### Valores de `accion` en `audit_log`

| accion | Cuándo |
|--------|--------|
| `crear` | Admin crea un producto, categoría o cupón |
| `actualizar` | Admin edita un producto o categoría |
| `eliminar` | Admin elimina producto, pedido, categoría, cupón o valoración |
| `cambio_estado` | Admin cambia el estado de un pedido |

### Comandos Drizzle Kit

```bash
npm run db:generate   # Genera SQL de migración desde el schema
npm run db:push       # Aplica el schema directamente a la DB (dev)
npm run db:studio     # Abre GUI visual de la DB en el navegador
```

### Seed inicial

Al arrancar, el backend crea las tablas (`CREATE TABLE IF NOT EXISTS`) y hace seed de:
- **15 productos** (6 portátiles, 6 gaming, 3 sobremesa) con imágenes de Unsplash
- **Cuentas locales de desarrollo** definidas por variables de entorno (`ADMIN_USER` / `ADMIN_PASS` y `USER_STANDARD` / `USER_PASS`)
- **Reseñas de ejemplo** en varios productos

---

## API REST

### Endpoints públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/productos` | Lista productos. Query: `busqueda`, `categoria`, `orden`, `desde`, `hasta`, `enStock`, `destacado` |
| GET | `/api/productos/:id` | Producto por ID |
| GET | `/api/productos/:id/valoraciones` | Reseñas del producto |
| POST | `/api/productos/:id/valoraciones` | Publicar reseña (rate limited, requiere token) |
| POST | `/api/pedidos` | Crear pedido con validación de precios server-side |
| POST | `/api/login` | Autenticar usuario (rate limited) |
| POST | `/api/register` | Registrar nuevo usuario |
| POST | `/api/logout` | Cerrar sesión (invalidar token) |
| GET | `/api/categorias` | Listar categorías |
| POST | `/api/cupones/validar` | Validar cupón y calcular descuento |

### Endpoints autenticados (usuario)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/usuario` | Datos del usuario actual |
| PUT | `/api/usuario/perfil` | Actualizar perfil (nombre, email, avatar, idioma…) |
| PUT | `/api/usuario/password` | Cambiar contraseña (verifica la actual con argon2) |
| POST | `/api/usuario/avatar` | Subir avatar |
| GET | `/api/mis-pedidos` | Pedidos del usuario autenticado con items |
| GET | `/api/favoritos` | Favoritos del usuario |
| POST | `/api/favoritos/:id` | Añadir producto a favoritos |
| DELETE | `/api/favoritos/:id` | Eliminar producto de favoritos |

### Endpoints admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/productos` | Crear producto |
| PUT | `/api/productos/:id` | Actualizar producto |
| DELETE | `/api/productos/:id` | Eliminar producto |
| PATCH | `/api/productos/:id/stock` | Actualizar stock y/o campo `activo` |
| POST | `/api/productos/:id/imagen` | Subir imagen del producto |
| GET | `/api/admin/pedidos` | Todos los pedidos |
| DELETE | `/api/admin/pedidos/:id` | Eliminar pedido |
| PATCH | `/api/pedidos/:id/estado` | Cambiar estado del pedido (+ notas opcionales) |
| GET | `/api/admin/pedidos/csv` | Exportar todos los pedidos en CSV |
| GET | `/api/admin/valoraciones` | Todas las reseñas (join producto + usuario) |
| DELETE | `/api/admin/valoraciones/:id` | Eliminar reseña |
| GET | `/api/admin/analytics` | Métricas dashboard: KPIs, gráficas, top productos, stock bajo |
| GET | `/api/admin/usuarios` | Listado de usuarios con `totalPedidos` via JOIN |
| GET | `/api/admin/cupones` | Listado de todos los cupones |
| POST | `/api/admin/cupones` | Crear cupón |
| DELETE | `/api/admin/cupones/:id` | Eliminar cupón |
| GET | `/api/admin/productos/csv` | Exportar todos los productos en CSV |
| POST | `/api/categorias` | Crear categoría |
| PUT | `/api/categorias/:id` | Actualizar categoría |
| DELETE | `/api/categorias/:id` | Eliminar categoría |
| GET | `/api/admin/audit-log` | Registro de auditoría. Query: `entidad`, `limit` (default 200) |

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

### Flujo de checkout

```
Usuario rellena carrito + datos de envío (nombre, email, dirección)
    │
    ▼
Validación Zod client-side (CheckoutSchema)
    │
    ▼
checkoutMutation.mutate()
    │  POST /api/pedidos  { cliente, email, direccion, items, cupon }
    ▼
Backend:
  1. Valida schema Zod (PedidoSchema)
  2. Verifica stock de cada producto
  3. Recalcula precios server-side (no confía en el cliente)
  4. Aplica descuento del cupón si existe
  5. Crea pedido + items en BD con estado = 'pendiente'
  6. Devuelve { pedidoId, total }
    │
    ▼
onSuccess → vacía carrito → navega a /mis-pedidos
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
node scripts/simulate_attacks.mjs [URL] [ADMIN_PASSWORD]
# Ejemplo:
node scripts/simulate_attacks.mjs http://localhost:3000 <ADMIN_PASS>
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

### Cambio de contraseña

```
PUT /api/usuario/password  { passwordActual, passwordNueva }
  → authenticate()
  → Busca usuario en BD
  → argon2.verify(passwordActual, hash almacenado)
  → argon2.hash(passwordNueva)
  → Actualiza hash en BD
  → Responde { ok: true }
```

### RBAC

| Acción | standard | admin |
|--------|----------|-------|
| Ver catálogo | Sí | Sí |
| Hacer pedidos | Sí | Sí |
| Ver historial propio | Sí | Sí |
| Editar perfil propio | Sí | Sí |
| Cambiar contraseña | Sí | Sí |
| Gestionar favoritos | Sí | Sí |
| Panel admin | No | Sí |
| CRUD productos | No | Sí |
| Gestión de stock | No | Sí |
| Eliminar pedidos | No | Sí |
| Cambiar estado pedidos | No | Sí |
| Gestionar reseñas | No | Sí |
| Gestionar cupones | No | Sí |
| Ver usuarios | No | Sí |
| Exportar CSV | No | Sí |
| Panel SOC | No | Sí |
| Ver eventos de seguridad | No | Sí |
| Ver registro de auditoría | No | Sí |

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
| Monitorización | Eventos de seguridad → `security_events`; acciones admin → `audit_log` |

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
CLOUDINARY_CLOUD_NAME=      # opcional
CLOUDINARY_API_KEY=         # opcional
CLOUDINARY_API_SECRET=      # opcional
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

> ADVERTENCIA: `docker-compose.yml`, `.env.example` y `backend/.env.example` son solo para desarrollo local. No los trates como base de una configuracion de produccion.

### Accesos

| Servicio | URL |
|----------|-----|
| Tienda HTTPS | https://localhost |
| Tienda HTTP | http://localhost:3000 |
| API directa | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado (openssl). En producción reemplazar con Let's Encrypt.

---

## Tests y CI/CD

### Arquitectura de tests

El proyecto usa **Vitest** tanto en frontend como en backend, sin necesidad de base de datos ni servidor real durante los tests.

#### Backend — tests de integración

Los tests usan `app.request()` de Hono para hacer peticiones HTTP directas a la app sin levantar un servidor TCP. La DB se mockea completamente con `vi.mock('../db/index')`.

```typescript
// Patrón de mock para Drizzle (cadena de métodos + thenable)
function makeChain(value = []) {
  const p = Promise.resolve(value);
  const q = { then: p.then.bind(p), catch: p.catch.bind(p) };
  for (const m of ['from','where','orderBy','limit','offset',...]) {
    q[m] = vi.fn(() => q);   // cada método devuelve la misma cadena
  }
  return q;
}
```

Módulos mockeados: `../db/index` (Drizzle + Pool), `argon2`, `stripe`, `cloudinary`, `fs`.

El backend exporta `app` y guarda el arranque del servidor bajo `NODE_ENV !== 'test'`:

```typescript
export { app };

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    await waitForDB();
    await initDB();
    serve({ fetch: app.fetch, port: PORT }, ...);
  })();
}
```

**Tests disponibles** (`backend/src/__tests__/`) — 103 tests:

| Test | Resultado esperado |
|------|--------------------|
| `GET /api/health` | 200 `{ status: "ok" }` |
| `GET /api/productos` | 200, array |
| `GET /api/categorias` | 200, array |
| `GET /api/calcular-costes?subtotal=50` | subtotal 50, IVA 10.50, envío 5.99, total 66.49 |
| `GET /api/calcular-costes?subtotal=100` | envío 0 (umbral gratis) |
| `POST /api/login` credenciales incorrectas | 401 `{ error: "Credenciales incorrectas" }` |
| `POST /api/login` credenciales correctas | 200, token string |
| `POST /api/login` 12 fallos misma IP | 429 (loginRateLimiter) |
| `POST /api/register` email inválido | 400 (Zod) |
| `GET /api/usuario` token válido | 200, datos del usuario |
| `GET /api/usuario` sin token | 401 |
| `POST /api/logout` con token | 200 |
| `POST /api/logout` sin token | 200 (idempotente) |
| `GET /api/mis-pedidos` token standard | 200, array |
| `GET /api/admin/pedidos` sin token | 401 |
| `GET /api/admin/pedidos` token standard | 403 |
| `GET /api/admin/pedidos` token admin | 200, array |
| `GET /api/admin/usuarios` token admin | 200, array |
| `GET /api/security/events` token admin | 200 |
| `GET /api/security/blocked-ips` token admin | 200 |
| `POST /api/forgot-password` sin email | 400 |
| `POST /api/forgot-password` email no registrado | 200 (anti-enumeración) |
| `POST /api/pedidos` con precio manipulado | total calculado con precio de BD, precio del body ignorado |

```bash
cd backend && npm test                # ejecutar una vez
cd backend && npm run test:coverage   # con cobertura (lcov + json-summary)
cd backend && npm run test:watch      # modo watch
```

#### Frontend — tests de componentes

Tests en jsdom con `@testing-library/react`. Los componentes con animaciones (Framer Motion) se mockean para evitar errores en el entorno de test.

```typescript
vi.mock('framer-motion', () => ({
  motion: {
    div:    (props) => <div    {...props} />,
    button: (props) => <button {...props} />,
    span:   (props) => <span   {...props} />,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
```

**Tests disponibles**:

| Archivo | Tests |
|---------|-------|
| `PasswordStrength.test.tsx` | contraseña vacía → null \| "abc" → Muy débil \| "abcdefg1" → Débil \| "MiPass123!" → Fuerte |
| `ProductCard.test.tsx` | nombre visible \| precio "€999.99" \| badge "En stock" |

```bash
cd frontend && npm run test:run    # ejecutar una vez
cd frontend && npm run test:watch  # modo watch
```

### GitHub Actions CI

`.github/workflows/ci.yml` — se ejecuta en cada push y PR a `main`. Cuatro jobs:

#### 1. `secret-scan` — Gitleaks
Escanea el historial completo del repositorio buscando secrets expuestos (tokens, contraseñas, claves API). Si detecta alguno, **bloquea el pipeline** con `exit 1`. Usa `continue-on-error: true` en el paso de Gitleaks para poder generar el Job Summary antes de fallar.

#### 2. `test-frontend` — typecheck + tests + cobertura
```yaml
- npm ci --legacy-peer-deps
- npx tsc --noEmit                    # TypeScript check
- npm run test:coverage               # Vitest con lcov + json-summary
- upload-artifact: frontend-coverage  # Sube lcov para SonarCloud
```
Umbrales de cobertura configurados en `vite.config.ts` (thresholds).

#### 3. `test-backend` — typecheck + tests + cobertura
```yaml
- npm ci
- npx tsc --noEmit                   # TypeScript check
- npm run test:coverage              # Vitest con lcov + json-summary
- upload-artifact: backend-coverage  # Sube lcov para SonarCloud
```
Umbrales: lines ≥ 30%, functions ≥ 30%, branches ≥ 14%, statements ≥ 27%.

#### 4. `quality` — SonarCloud (`needs: [test-frontend, test-backend]`, `if: always()`)
```yaml
- actions/checkout fetch-depth: 0       # historial completo para blame
- download-artifact: frontend-coverage  # lcov del job frontend
- download-artifact: backend-coverage   # lcov del job backend
- SonarSource/sonarcloud-github-action  # análisis estático (continue-on-error: true)
```
No bloquea el push aunque SonarCloud encuentre issues. El dashboard está en `sonarcloud.io/project/overview?id=ddelbarriojuan-code_Proyecto_web`.

#### Job Summary
Cada job escribe un resumen en `$GITHUB_STEP_SUMMARY` generado por `.github/scripts/coverage-summary.js`. El script analiza el `coverage-summary.json` y genera:
- Tabla de cobertura global (líneas, funciones, ramas, sentencias)
- Lista de archivos con cobertura mejorable (< 50%)
- **Párrafo en lenguaje natural** en español que explica el estado, el riesgo concreto y el siguiente paso accionable

> No requiere PostgreSQL ni Docker en CI: toda la BD se mockea en los tests de backend.

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

> **Nota**: `vite.config.ts` NO está montado como volumen. Cualquier cambio requiere reconstruir la imagen: `docker compose up --build -d frontend`

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
node scripts/simulate_attacks.mjs http://localhost:3000 <ADMIN_PASS>

# Personalizar URL si usas otro puerto
node scripts/simulate_attacks.mjs http://localhost:3001 <ADMIN_PASS>
```

### Usuarios de ejemplo

ADVERTENCIA: estas cuentas son solo para desarrollo local y dependen de tus variables de entorno. No documentes ni reutilices credenciales triviales en entornos compartidos o produccion.

| Username | Password | Rol |
|----------|----------|-----|
| `ADMIN_USER` | `ADMIN_PASS` | admin |
| `USER_STANDARD` | `USER_PASS` | standard |

### Estructura de interfaces TypeScript

```typescript
// interfaces.ts
interface Producto {
  id: number; nombre: string; descripcion: string;
  precio: number; imagen: string; categoria: string;
  stock: number; activo: boolean; destacado: boolean;
}

interface Pedido {
  id: number; cliente: string; email: string; direccion: string;
  total: number; estado: string; notas?: string; fecha: string;
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

### Añadir un nuevo registro de auditoría

En `backend/src/index.ts`, dentro de cualquier ruta protegida con `authenticate + requireAdmin`:

```typescript
const u = c.get('user');
await logAudit(u.id, u.username, 'accion', 'entidad', entidadId, 'detalles opcionales');
```

| Parámetro | Tipo | Ejemplo |
|-----------|------|---------|
| `adminId` | number | `u.id` |
| `adminUsername` | string | `u.username` |
| `accion` | string | `'crear'` \| `'actualizar'` \| `'eliminar'` \| `'cambio_estado'` |
| `entidad` | string | `'producto'` \| `'pedido'` \| `'categoria'` \| `'cupon'` \| `'valoracion'` |
| `entidadId` | number? | ID del registro afectado |
| `detalles` | string? | Información adicional (ej. `'Nombre: Portátil HP'`) |

El registro aparece en la pestaña **Auditoría** del panel admin al pulsar "Actualizar".

---

*Última actualización: 29/03/2026 — 296 tests frontend · 103 tests backend · ChatBot · menú de usuario · 2FA TOTP · BrandCarousel rediseñado*
