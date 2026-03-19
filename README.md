# Kratamex - Tienda Online de Ordenadores

## Estructura del Proyecto

```
proyecto/
├── frontend/              # React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/
│   │   │   │   ├── Admin.tsx
│   │   │   │   └── Admin.module.css
│   │   │   ├── ProductCard.tsx         # Tarjeta de producto con Framer Motion
│   │   │   ├── ProductoDetalle.tsx     # Página de detalle + comentarios
│   │   │   ├── SkeletonCard.tsx        # Skeleton loading placeholder
│   │   │   ├── SecurityBadge.tsx       # Indicador TLS en header
│   │   │   ├── PasswordStrength.tsx    # Barra de fuerza de contraseña
│   │   │   └── OptimizedImage.tsx      # Imagen con lazy loading
│   │   ├── App.tsx        # Componente tienda principal + router
│   │   ├── main.tsx       # Punto de entrada con QueryClientProvider + BrowserRouter
│   │   ├── index.css      # Estilos globales (Glassmorphism)
│   │   └── interfaces.ts  # Interfaces TypeScript
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/               # API REST con Hono + Drizzle ORM + PostgreSQL
│   ├── src/
│   │   ├── index.ts       # Servidor Hono, rutas, middlewares, seed
│   │   ├── schemas.ts     # Esquemas de validación Zod
│   │   └── db/
│   │       ├── schema.ts  # Schema de Drizzle ORM (tablas con tipos TypeScript)
│   │       └── index.ts   # Conexión Drizzle + Pool pg
│   ├── drizzle.config.ts  # Configuración Drizzle Kit (migraciones)
│   ├── tsconfig.json      # Configuración TypeScript
│   ├── package.json
│   └── Dockerfile
├── nginx/                 # Reverse proxy HTTPS
│   ├── nginx.conf
│   └── certs/
├── docker-compose.yml     # Orquestación (4 servicios)
├── .env.example           # Variables de entorno raíz
├── correcciones_seguridad.md
├── DOCUMENTACION_COMPLETA.md
└── README.md
```

## Tecnologías

### Frontend
- **React 19** + **TypeScript** — Framework de UI
- **Vite 5** — Build tool con HMR
- **TanStack Query v5** — Caché de datos del servidor, estados de carga y error
- **Zod** — Validación de formularios client-side (checkout, comentarios)
- **Framer Motion** — Micro-interacciones y animaciones
- **Lucide React** — Iconos SVG
- **Recharts** — Gráficas del dashboard admin
- **React Router v6** — Routing (/, /producto/:id, /admin)

### Backend
- **Hono** — Framework web ultra-ligero, TypeScript nativo, compatible con Edge/Node/Bun
- **@hono/node-server** — Adaptador Node.js para Hono
- **@hono/zod-validator** — Validación de requests por ruta con Zod
- **Drizzle ORM** — ORM type-safe, queries SQL con tipos TypeScript inferidos
- **PostgreSQL 16** — Base de datos relacional (driver pg)
- **Zod** — Esquemas de validación compartidos entre rutas
- **argon2** — Hashing de contraseñas (argon2id, ganador PHC)
- **Cloudinary** — Almacenamiento de avatares en CDN (fallback local si no hay credenciales)
- **tsx** — Runtime TypeScript para desarrollo con hot-reload
- **TypeScript** — Tipado completo del backend

### Infraestructura
- **Docker Compose** — Orquestación de 4 servicios
- **nginx:alpine** — Reverse proxy con TLS
- **postgres:16-alpine** — Base de datos

## Frontend — Páginas y Componentes

### Tienda (`/`)
- Hero con trust badges, barra de búsqueda en header, pills de categoría
- Productos con TanStack Query (caché 30s, skeleton loading automático)
- Carrito lateral con checkout validado por Zod + useMutation

### Detalle de Producto (`/producto/:id`)
- Vista ampliada con imagen, especificaciones técnicas, precio e IVA
- Sección de comentarios de clientes con formulario validado por Zod
- Breadcrumb de navegación (Tienda → Categoría → Producto)

### Admin (`/admin`)
- Dashboard con métricas y gráficas (Recharts)
- CRUD completo de productos
- Gestión de pedidos

## Backend — API REST

### Endpoints

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /api/productos | No | Listar productos (filtros: busqueda, categoria, orden, desde, hasta) |
| GET | /api/productos/:id | No | Obtener producto por ID |
| POST | /api/productos | Admin | Crear producto |
| PUT | /api/productos/:id | Admin | Actualizar producto |
| DELETE | /api/productos/:id | Admin | Eliminar producto |
| GET | /api/productos/:id/comentarios | No | Listar comentarios del producto |
| POST | /api/productos/:id/comentarios | No | Publicar comentario (rate limited: 10/min) |
| POST | /api/pedidos | No | Crear pedido (rate limited: 10/60s) |
| GET | /api/pedidos | Admin | Listar pedidos |
| GET | /api/pedidos/:id | Admin | Obtener pedido con items |
| POST | /api/login | No | Autenticar (rate limited: 12 intentos/bloqueo 60s) |
| POST | /api/logout | Token | Cerrar sesión |
| GET | /api/usuario | Token | Datos del usuario autenticado |
| POST | /api/usuario/avatar | Token | Subir avatar (Cloudinary o local) |
| GET | /api/admin/pedidos | Admin | Listar pedidos (admin) |
| DELETE | /api/admin/pedidos/:id | Admin | Eliminar pedido |

### Validación con Zod

Todas las rutas con body o query params tienen un esquema Zod asociado validado automáticamente por `@hono/zod-validator`. Si el input no cumple el esquema, Hono devuelve 400 antes de ejecutar el handler.

Esquemas definidos en `backend/src/schemas.ts`:
- `ProductoBodySchema` — nombre, descripcion, precio, imagen, categoria
- `ProductosQuerySchema` — busqueda, categoria, orden, desde, hasta
- `LoginSchema` — username, password
- `PedidoSchema` — cliente, email, direccion, items[]
- `ComentarioSchema` — autor, contenido

### Base de Datos — PostgreSQL + Drizzle ORM

Schema definido en `backend/src/db/schema.ts` con tipos inferidos automáticamente:

Tablas: `productos`, `pedidos`, `pedido_items`, `usuarios`, `comentarios`

```bash
# Comandos Drizzle Kit
npm run db:generate   # Genera archivos de migración SQL desde el schema
npm run db:push       # Aplica el schema directamente a la DB (dev)
npm run db:studio     # Abre GUI visual de la base de datos
```

Usuarios de ejemplo:

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |
| user | user123 | standard |

> Las contraseñas se almacenan como hashes argon2id, nunca en texto plano.

### Cloudinary (opcional)

Para usar Cloudinary en subida de avatares, añadir al `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

Si las variables no están configuradas, los avatares se guardan localmente en `src/avatars/`.

## Autenticación y RBAC

| Acción | standard | admin |
|--------|----------|-------|
| Ver productos | Sí | Sí |
| Hacer pedidos | Sí | Sí |
| Panel admin | No | Sí |
| CRUD productos | No | Sí |
| Eliminar pedidos | No | Sí |

Flujo: `POST /api/login` → token (256 bits) → `Authorization: <token>` → `POST /api/logout`

TTL de sesión: 8 horas. Limpieza automática cada 15 minutos.

## Seguridad

- **argon2id** — Hashing de contraseñas (PHC winner, async)
- **Zod** — Validación de input en todas las rutas (esquemas por ruta con @hono/zod-validator)
- **Drizzle ORM** — Queries parametrizadas por construcción (sin concatenación SQL)
- **Rate limiting** — Login (12 intentos/bloqueo), Checkout (10/60s), Comentarios (10/min), General (60/min)
- **HTTPS** — TLS terminado en nginx (TLSv1.2/1.3)
- **CORS restringido** — Solo `CORS_ORIGIN` de `.env`
- **Tokens criptográficos** — `crypto.randomBytes(32)` (256 bits)
- **Security headers** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
- **Validación de uploads** — Solo imágenes, límites de tamaño, nombres aleatorios
- **Sesiones con TTL** — Expiran automáticamente a las 8 horas
- **33 vulnerabilidades documentadas** — Ver `correcciones_seguridad.md`

## Ejecución

### Con Docker (recomendado)

```bash
# Copiar variables de entorno
cp .env.example .env
cp backend/.env.example backend/.env

# Levantar los 4 servicios
docker compose up --build -d
```

| Servicio | URL |
|----------|-----|
| Web (HTTPS) | https://localhost |
| Web (HTTP → redirige) | http://localhost |
| Frontend directo | http://localhost:3000 |
| Backend directo | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado (desarrollo). En producción usar Let's Encrypt.

### Manual

```bash
# Backend (TypeScript con tsx)
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

Requiere PostgreSQL corriendo en localhost:5432 con las credenciales de `backend/.env`.

### Nota sobre node_modules en Docker

Si añades nuevas dependencias con `npm install` en el host, los contenedores Docker usan volúmenes nombrados para `node_modules`. Para sincronizarlos:

```bash
# Instalar en el contenedor en ejecución
docker compose exec backend npm install <paquete>
docker compose restart backend

# O reconstruir la imagen completa (más lento)
docker compose up --build -d backend
```

---

*Última actualización: 19/03/2026*
