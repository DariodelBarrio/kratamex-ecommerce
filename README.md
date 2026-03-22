# Kratamex — Tienda Online de Ordenadores

## Estructura del Proyecto

```
proyecto/
├── frontend/              # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/
│   │   │   │   ├── Admin.tsx               # Panel de administración
│   │   │   │   └── Admin.module.css        # Estilos (CSS Modules)
│   │   │   ├── SecurityDashboard.tsx       # SOC — panel de ciberseguridad
│   │   │   ├── SecurityDashboard.module.css
│   │   │   ├── Checkout.tsx                # Pago con Stripe Elements (PaymentElement)
│   │   │   ├── OrderHistory.tsx            # Historial de pedidos del usuario
│   │   │   ├── UserProfile.tsx             # Perfil editable del usuario
│   │   │   ├── ProductCard.tsx             # Tarjeta de producto con Framer Motion
│   │   │   ├── ProductoDetalle.tsx         # Página de detalle + comentarios
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
│   │   ├── index.ts       # Servidor Hono, rutas, middlewares, seed, logger SOC
│   │   ├── schemas.ts     # Esquemas de validación Zod
│   │   └── db/
│   │       ├── schema.ts  # Schema Drizzle ORM (tablas con tipos TypeScript)
│   │       └── index.ts   # Conexión Drizzle + Pool pg
│   ├── drizzle.config.ts
│   ├── package.json
│   └── Dockerfile
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
- **@stripe/stripe-js** + **@stripe/react-stripe-js** — Stripe Elements (PaymentElement)

### Backend
- **Hono** — Framework web ultra-ligero, TypeScript nativo
- **@hono/node-server** — Adaptador Node.js
- **@hono/zod-validator** — Validación de requests por ruta
- **Drizzle ORM** — ORM type-safe con queries parametrizadas
- **PostgreSQL 16** — Base de datos relacional (driver pg)
- **argon2** — Hashing de contraseñas (argon2id)
- **Cloudinary** — CDN para imágenes (fallback local)
- **stripe** — Creación de PaymentIntents y verificación de webhooks
- **tsx** — Runtime TypeScript con hot-reload

### Infraestructura
- **Docker Compose** — Orquestación de 4 servicios
- **nginx:alpine** — Reverse proxy con TLS 1.2/1.3
- **postgres:16-alpine** — Base de datos

## Páginas y Rutas

| Ruta | Componente | Auth | Descripción |
|------|-----------|------|-------------|
| `/` | App.tsx | No | Tienda — catálogo, búsqueda, filtros, carrito |
| `/producto/:id` | ProductoDetalle | No | Detalle de producto + reseñas |
| `/login` | — (inline) | No | Login de usuario |
| `/registro` | — (inline) | No | Registro de usuario |
| `/perfil` | UserProfile | Usuario | Perfil editable (avatar, email, idioma) |
| `/mis-pedidos` | OrderHistory | Usuario | Historial de pedidos con desglose |
| `/admin` | Admin | Admin | Panel de administración completo |
| `/panel` | SecurityDashboard | Admin (SOC) | Centro de operaciones de ciberseguridad |

## Admin (`/admin`) — Pestañas

- **Dashboard** — Métricas (pedidos, ingresos, ticket medio, clientes únicos), gráficas AreaChart/LineChart, tabla de compras
- **Productos** — CRUD completo, subida de imagen (drag-and-drop, preview, JPG/PNG/WEBP, máx. 5 MB)
- **Pedidos** — Listado y eliminación de pedidos
- **Reseñas** — Todas las valoraciones de clientes con estrellas, texto y opción de borrado individual

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
| GET | `/api/productos` | No | Listar productos (filtros: busqueda, categoria, orden, desde, hasta) |
| GET | `/api/productos/:id` | No | Obtener producto por ID |
| GET | `/api/productos/:id/comentarios` | No | Listar reseñas del producto |
| POST | `/api/productos/:id/comentarios` | No | Publicar reseña (rate limited: 10/min) |
| POST | `/api/pedidos` | No | Crear pedido (rate limited: 10/60s) |
| POST | `/api/pedidos/checkout` | Opcional | Crear pedido + Stripe PaymentIntent → devuelve `clientSecret` |
| POST | `/api/webhook` | — | Webhook Stripe: `payment_intent.succeeded` → marca pedido como `pagado` |
| POST | `/api/login` | No | Autenticar (rate limited: 12 intentos/bloqueo 60s) |
| POST | `/api/registro` | No | Registrar usuario |
| POST | `/api/logout` | Token | Cerrar sesión |
| GET | `/api/usuario` | Token | Datos del usuario autenticado |
| PUT | `/api/usuario/perfil` | Token | Actualizar perfil (nombre, email, avatar, idioma…) |
| POST | `/api/usuario/avatar` | Token | Subir avatar (Cloudinary o local) |
| GET | `/api/mis-pedidos` | Token | Pedidos del usuario autenticado |

### Endpoints de administración

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/productos` | Admin | Crear producto |
| PUT | `/api/productos/:id` | Admin | Actualizar producto |
| DELETE | `/api/productos/:id` | Admin | Eliminar producto |
| POST | `/api/productos/:id/imagen` | Admin | Subir imagen (máx. 5 MB) |
| GET | `/api/admin/pedidos` | Admin | Listar todos los pedidos |
| DELETE | `/api/admin/pedidos/:id` | Admin | Eliminar pedido |
| GET | `/api/admin/valoraciones` | Admin | Todas las reseñas (con producto y usuario) |
| DELETE | `/api/admin/valoraciones/:id` | Admin | Eliminar reseña |

### Endpoints SOC (Security Operations Center)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/api/security/stats` | Admin | Métricas de seguridad 24h (fallos, brute, IPs, sesiones, hourly, top IPs) |
| GET | `/api/security/events` | Admin | Log de eventos (filtros: tipo, limit) |

## Base de Datos

Tablas: `productos`, `pedidos`, `pedido_items`, `usuarios`, `comentarios`, **`security_events`**

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
- **Rate limiting** — Login (12 intentos/60s bloqueo), Checkout (10/60s), Comentarios (10/min), General (60/min)
- **Drizzle ORM** — Queries parametrizadas (sin concatenación SQL)
- **Zod** — Validación de input en todas las rutas
- **HTTPS** — TLS 1.2/1.3 terminado en nginx
- **Tokens criptográficos** — `crypto.randomBytes(32)` (256 bits, TTL 8h)
- **CORS restringido** — Solo `CORS_ORIGIN` de `.env`
- **Security headers** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options
- **Monitorización SOC** — Todos los eventos de seguridad se registran en PostgreSQL
- **Anti-autofill SOC** — Login del panel SOC con inputs honeypot y `name` no estándar

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

### Stripe (modo test)

1. Obtén tus claves en [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)
2. Añade en `backend/.env`:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # solo necesario para verificar webhooks en producción
```
3. Añade en `frontend/.env`:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```
4. Reconstruye la imagen del frontend: `docker compose build frontend && docker compose up -d`

**Tarjetas de prueba:**

| Número | Resultado |
|--------|-----------|
| `4242 4242 4242 4242` | Pago aprobado |
| `4000 0000 0000 9995` | Fondos insuficientes |

En ambas: fecha futura · CVC `123` · CP `12345`

---

*Última actualización: 22/03/2026*
