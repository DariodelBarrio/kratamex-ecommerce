# Kratamex — Tienda Online de Ordenadores

## Estructura del Proyecto

```
proyecto/
├── frontend/              # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── test/
│   │   │   ├── PasswordStrength.test.tsx  # Tests del componente PasswordStrength
│   │   │   └── ProductCard.test.tsx       # Tests del componente ProductCard
│   │   ├── components/
│   │   │   ├── Admin/
│   │   │   │   ├── Admin.tsx               # Panel de administración
│   │   │   │   └── Admin.module.css        # Estilos (CSS Modules)
│   │   │   ├── SecurityDashboard.tsx       # SOC — panel de ciberseguridad
│   │   │   ├── SecurityDashboard.module.css
│   │   │   ├── OrderHistory.tsx            # Historial de pedidos del usuario
│   │   │   ├── UserProfile.tsx             # Perfil editable + cambio de contraseña
│   │   │   ├── ProductCard.tsx             # Tarjeta de producto con Framer Motion
│   │   │   ├── ProductoDetalle.tsx         # Página de detalle + reseñas
│   │   │   ├── SkeletonCard.tsx            # Skeleton loading placeholder
│   │   │   ├── SecurityBadge.tsx           # Indicador TLS en header
│   │   │   ├── PasswordStrength.tsx        # Barra de fuerza de contraseña
│   │   │   └── OptimizedImage.tsx          # Imagen con lazy loading
│   │   ├── App.tsx        # Componente tienda principal + router
│   │   ├── main.tsx       # Punto de entrada con QueryClientProvider + BrowserRouter
│   │   ├── api.ts         # Funciones fetch centralizadas
│   │   ├── i18n.ts        # Internacionalización (es/en)
│   │   ├── index.css      # Estilos globales + dark/light mode
│   │   └── interfaces.ts  # Interfaces TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/               # API REST con Hono + Drizzle ORM + PostgreSQL
│   ├── src/
│   │   ├── __tests__/
│   │   │   └── api.test.ts    # Tests de integración (Vitest + Hono app.request)
│   │   ├── index.ts       # Servidor Hono, rutas, middlewares, seed, logger SOC
│   │   ├── schemas.ts     # Esquemas de validación Zod
│   │   └── db/
│   │       ├── schema.ts  # Schema Drizzle ORM (tablas con tipos TypeScript)
│   │       └── index.ts   # Conexión Drizzle + Pool pg
│   ├── drizzle.config.ts
│   ├── vitest.config.ts
│   ├── package.json
│   └── Dockerfile
├── .github/
│   ├── workflows/
│   │   └── ci.yml         # GitHub Actions CI (secret-scan + tests + SonarCloud)
│   └── scripts/
│       └── coverage-summary.js  # Genera Job Summary con párrafo en lenguaje natural
├── sonar-project.properties     # Configuración SonarCloud
├── nginx/                 # Reverse proxy HTTPS
│   ├── nginx.conf
│   └── certs/
├── docker-compose.yml     # Orquestación (4 servicios)
├── simulate_attacks.mjs   # Script de simulación de ataques (Node 18+)
├── .env.example
├── correcciones_seguridad.md
├── DOCUMENTACION_COMPLETA.md
└── README.md
```

## Tecnologías

### Frontend
- **React 19** + **TypeScript** — Framework de UI
- **Vite 8** — Build tool con HMR (manualChunks como función para Rolldown)
- **TanStack Query v5** — Caché de datos, estados de carga y error
- **Framer Motion** — Micro-interacciones, animaciones, efecto 3D tilt
- **Recharts** — Gráficas en admin dashboard y SOC panel
- **Lucide React** — Iconos SVG
- **React Router v6** — Routing SPA
- **Zod** — Validación de formularios client-side

### Backend
- **Hono** — Framework web ultra-ligero, TypeScript nativo
- **@hono/node-server** — Adaptador Node.js
- **@hono/zod-validator** — Validación de requests por ruta
- **Drizzle ORM** — ORM type-safe con queries parametrizadas
- **PostgreSQL 16** — Base de datos relacional (driver pg)
- **argon2** — Hashing de contraseñas (argon2id)
- **Cloudinary** — CDN para imágenes (fallback local)
- **tsx** — Runtime TypeScript con hot-reload

### Infraestructura y Testing
- **Docker Compose** — Orquestación de 4 servicios
- **nginx:alpine** — Reverse proxy con TLS 1.2/1.3
- **postgres:16-alpine** — Base de datos
- **Vitest** — Tests unitarios y de integración (frontend y backend)
- **@testing-library/react** — Renderizado de componentes en jsdom
- **GitHub Actions** — CI automático en cada push a `main`
- **SonarCloud** — Análisis de calidad de código estático (cobertura lcov, code smells, bugs)
- **Gitleaks** — Escaneo de secrets en cada commit (bloquea el push si detecta credenciales expuestas)

## Páginas y Rutas

| Ruta | Componente | Auth | Descripción |
|------|-----------|------|-------------|
| `/` | App.tsx | No | Tienda — catálogo, búsqueda, filtros, carrito |
| `/producto/:id` | ProductoDetalle | No | Detalle de producto + reseñas |
| `/login` | — (inline) | No | Login de usuario |
| `/registro` | — (inline) | No | Registro de usuario |
| `/perfil` | UserProfile | Usuario | Perfil editable (avatar, email, idioma) + cambio de contraseña |
| `/mis-pedidos` | OrderHistory | Usuario | Historial de pedidos con desglose |
| `/admin` | Admin | Admin | Panel de administración completo |
| `/panel` | SecurityDashboard | Admin (SOC) | Centro de operaciones de ciberseguridad |
| `/*` | — (inline) | No | Página 404 con enlace a la tienda |

## Admin (`/admin`) — Pestañas

- **Dashboard** — Métricas (pedidos, ingresos, ticket medio, clientes únicos, productos en catálogo), gráficas AreaChart/LineChart, top productos más vendidos, alerta de stock bajo, exportación CSV
- **Productos** — CRUD completo, subida de imagen (drag-and-drop, preview, JPG/PNG/WEBP, máx. 5 MB), gestión de stock inline (edición directa, badge de color verde/naranja/rojo), toggle Activo/Oculto por producto
- **Pedidos** — Listado, cambio de estado inline (pendiente → confirmado → enviado → entregado → cancelado), eliminación, exportación CSV
- **Reseñas** — Todas las valoraciones de clientes con estrellas, texto y opción de borrado individual
- **Cupones** — CRUD de cupones de descuento (porcentaje o importe fijo, fecha de validez, usos máximos)
- **Usuarios** — Listado de todos los usuarios con rol, email, total de pedidos y fecha de registro

## SOC Panel (`/panel`) — Security Operations Center

Panel de ciberseguridad independiente con estética terminal/cyberpunk (fondo oscuro, tipografía monoespaciada, acento verde neón).

### Métricas en tiempo real
- Nivel de amenaza (BAJO / MEDIO / ALTO / CRÍTICO)
- Fallos de login (24h)
- Ataques de fuerza bruta (24h)
- Logins exitosos (24h)
- Tokens inválidos (24h)
- IPs únicas (24h)
- Sesiones activas (ahora)

### Visualizaciones
- AreaChart de actividad por hora (login_ok, login_fail, brute_force)
- BarChart + ranking top 10 IPs con más eventos
- Log de eventos en tabla con filtros por tipo, auto-refresh cada 15 s

### Tipos de evento monitorizados
| Tipo | Descripción |
|------|-------------|
| `login_ok` | Autenticación exitosa |
| `login_fail` | Credenciales incorrectas |
| `brute_force` | IP bloqueada tras ≥12 intentos |
| `auth_invalid` | Token no válido o expirado |
| `register` | Nuevo registro de usuario |
| `forbidden` | Acceso a ruta sin permisos |

### Simulador de ataques

```bash
# Genera eventos de prueba visibles en el panel SOC
node simulate_attacks.mjs http://localhost:3000 <tu_password>
```

Simula: fallos de login masivos (IPs variadas), fuerza bruta (IP fija, 13 intentos), tokens inválidos, escaneo de rutas sensibles, segundo brute force.

## Backend — API REST

### Endpoints públicos y de usuario

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/productos` | No | Listar productos (filtros: busqueda, categoria, orden, desde, hasta, enStock, destacado) |
| GET | `/api/productos/:id` | No | Obtener producto por ID |
| GET | `/api/productos/:id/valoraciones` | No | Listar reseñas del producto |
| POST | `/api/productos/:id/valoraciones` | Token | Publicar reseña (rate limited: 10/min) |
| POST | `/api/pedidos` | No | Crear pedido (rate limited: 10/60s) |
| POST | `/api/login` | No | Autenticar (rate limited: 12 intentos/bloqueo 60s) |
| POST | `/api/register` | No | Registrar usuario |
| POST | `/api/logout` | Token | Cerrar sesión |
| GET | `/api/usuario` | Token | Datos del usuario autenticado |
| PUT | `/api/usuario/perfil` | Token | Actualizar perfil (nombre, email, avatar, idioma…) |
| PUT | `/api/usuario/password` | Token | Cambiar contraseña (verifica la actual con argon2) |
| POST | `/api/usuario/avatar` | Token | Subir avatar (Cloudinary o local) |
| GET | `/api/mis-pedidos` | Token | Pedidos del usuario autenticado |
| GET | `/api/favoritos` | Token | Favoritos del usuario |
| POST | `/api/favoritos/:id` | Token | Añadir a favoritos |
| DELETE | `/api/favoritos/:id` | Token | Eliminar de favoritos |
| GET | `/api/categorias` | No | Listar categorías |
| POST | `/api/cupones/validar` | No | Validar cupón y calcular descuento |

### Endpoints de administración

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/productos` | Admin | Crear producto |
| PUT | `/api/productos/:id` | Admin | Actualizar producto |
| DELETE | `/api/productos/:id` | Admin | Eliminar producto |
| PATCH | `/api/productos/:id/stock` | Admin | Actualizar stock y/o visibilidad (activo) |
| POST | `/api/productos/:id/imagen` | Admin | Subir imagen (máx. 5 MB) |
| GET | `/api/admin/pedidos` | Admin | Listar todos los pedidos |
| DELETE | `/api/admin/pedidos/:id` | Admin | Eliminar pedido |
| PATCH | `/api/pedidos/:id/estado` | Admin | Cambiar estado del pedido + notas |
| GET | `/api/admin/pedidos/csv` | Admin | Exportar pedidos en formato CSV |
| GET | `/api/admin/valoraciones` | Admin | Todas las reseñas (con producto y usuario) |
| DELETE | `/api/admin/valoraciones/:id` | Admin | Eliminar reseña |
| GET | `/api/admin/analytics` | Admin | Métricas del dashboard (KPIs, gráficas, top productos, stock bajo) |
| GET | `/api/admin/usuarios` | Admin | Listado de usuarios con total de pedidos |
| GET | `/api/admin/cupones` | Admin | Listado de cupones |
| POST | `/api/admin/cupones` | Admin | Crear cupón |
| DELETE | `/api/admin/cupones/:id` | Admin | Eliminar cupón |
| GET | `/api/admin/productos/csv` | Admin | Exportar productos en formato CSV |
| POST | `/api/categorias` | Admin | Crear categoría |
| PUT | `/api/categorias/:id` | Admin | Actualizar categoría |
| DELETE | `/api/categorias/:id` | Admin | Eliminar categoría |

### Endpoints SOC (Security Operations Center)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/security/stats` | Admin | Métricas de seguridad 24h (fallos, brute, IPs, sesiones, hourly, top IPs) |
| GET | `/api/security/events` | Admin | Log de eventos (filtros: tipo, limit) |

## Base de Datos

Tablas: `productos`, `pedidos`, `pedido_items`, `usuarios`, `comentarios`, `cupones`, `favoritos`, **`security_events`**

```bash
npm run db:generate   # Genera archivos de migración SQL
npm run db:push       # Aplica schema a la DB (dev)
npm run db:studio     # GUI visual de la base de datos
```

### Usuarios de ejemplo

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |
| user | user123 | standard |

> Contraseñas almacenadas como hashes argon2id.

## Seguridad

- **argon2id** — Hashing de contraseñas
- **Rate limiting** — Login (12 intentos/60s bloqueo), Pedidos (10/60s), Comentarios (10/min), General (60/min)
- **Drizzle ORM** — Queries parametrizadas (sin concatenación SQL)
- **Zod** — Validación de input en todas las rutas
- **HTTPS** — TLS 1.2/1.3 terminado en nginx
- **Tokens criptográficos** — `crypto.randomBytes(32)` (256 bits, TTL 8h)
- **CORS restringido** — Solo `CORS_ORIGIN` de `.env`
- **Security headers** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options
- **Monitorización SOC** — Todos los eventos de seguridad se registran en PostgreSQL
- **Anti-autofill SOC** — Login del panel SOC con inputs honeypot y `name` no estándar

## Tests

### Frontend (Vitest + @testing-library/react)

```bash
cd frontend && npm run test:run
```

| Archivo | Tests |
|---------|-------|
| `src/test/PasswordStrength.test.tsx` | Vacía → null, "Muy débil", "Débil", "Fuerte" |
| `src/test/ProductCard.test.tsx` | Nombre, precio formateado, badge "En stock" |

### Backend (Vitest + Hono app.request)

```bash
cd backend && npm test
cd backend && npm run test:coverage   # genera lcov + json-summary
```

23 tests en `backend/src/__tests__/api.test.ts`:

| Test | Resultado esperado |
|------|--------------------|
| `GET /api/health` | 200 `{ status: "ok" }` |
| `GET /api/productos` | 200, array |
| `GET /api/categorias` | 200, array |
| `GET /api/calcular-costes?subtotal=50` | IVA 21% + envío €5.99 |
| `GET /api/calcular-costes?subtotal=100` | envío gratis |
| `POST /api/login` credenciales incorrectas | 401 |
| `POST /api/login` credenciales correctas | 200 + token |
| `POST /api/login` 12 fallos desde misma IP | 429 (rate limiting) |
| `POST /api/register` email inválido | 400 |
| `GET /api/usuario` token válido | 200 + datos usuario |
| `GET /api/usuario` sin token | 401 |
| `POST /api/logout` con token | 200 |
| `POST /api/logout` sin token | 200 (idempotente) |
| `GET /api/mis-pedidos` token usuario | 200, array |
| `GET /api/admin/pedidos` sin token | 401 |
| `GET /api/admin/pedidos` token standard | 403 |
| `GET /api/admin/pedidos` token admin | 200, array |
| `GET /api/admin/usuarios` token admin | 200, array |
| `GET /api/security/events` token admin | 200 |
| `GET /api/security/blocked-ips` token admin | 200 |
| `POST /api/forgot-password` sin email | 400 |
| `POST /api/forgot-password` email no registrado | 200 (anti-enumeración) |
| `POST /api/pedidos` precio manipulado en body | precio ignorado, total calculado con precio de BD |

> El backend no necesita PostgreSQL para los tests: la DB se mockea con Vitest.

### CI (GitHub Actions)

En cada push a `main` se ejecutan automáticamente 4 jobs:
1. `secret-scan` — Gitleaks escanea el historial completo buscando secrets expuestos (bloquea si encuentra)
2. `test-frontend` — typecheck TypeScript + Vitest + cobertura (lcov + json-summary)
3. `test-backend` — typecheck TypeScript + Vitest + cobertura (lcov + json-summary)
4. `quality` — SonarCloud descarga artifacts de cobertura y ejecuta análisis estático (no bloquea)

---

## Ejecución

### Con Docker (recomendado)

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build -d
```

| Servicio | URL |
|----------|-----|
| Web (HTTPS) | https://localhost |
| Web (HTTP) | http://localhost:3000 |
| Backend directo | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado. En producción usar Let's Encrypt.

### Manual

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

### Forzar HMR en Docker/Windows

```bash
# Si Vite no detecta cambios (NTFS → Linux fs)
docker compose exec frontend sh -c "touch /app/src/components/MiComponente.tsx"
```

### Cloudinary (opcional)

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

Sin estas variables las imágenes se guardan localmente en `src/uploads/` y `src/avatars/`.

---

*Última actualización: 23/03/2026 — v2.2 (SonarCloud + Gitleaks + 23 tests backend)*
