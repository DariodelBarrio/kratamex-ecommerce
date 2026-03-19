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
│   │   │   ├── ProductCard.tsx       # Tarjeta de producto con Framer Motion
│   │   │   ├── SkeletonCard.tsx      # Skeleton loading placeholder
│   │   │   ├── SecurityBadge.tsx     # Indicador TLS en header
│   │   │   ├── PasswordStrength.tsx  # Barra de fuerza de contraseña
│   │   │   └── OptimizedImage.tsx    # Imagen con lazy loading
│   │   ├── App.tsx        # Componente tienda principal
│   │   ├── main.tsx       # Punto de entrada con React Router
│   │   ├── index.css      # Estilos globales (Glassmorphism)
│   │   ├── interfaces.ts  # Interfaces TypeScript
│   │   └── utils.ts       # Funciones de utilidad
│   ├── package.json
│   ├── vite.config.ts
│   └── Dockerfile
├── backend/               # API REST con Express + PostgreSQL
│   ├── src/
│   │   ├── index.js       # Servidor, rutas y lógica
│   │   └── db.js          # Pool de conexión PostgreSQL
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
- **Framer Motion** — Micro-interacciones y animaciones
- **Lucide React** — Iconos SVG
- **Recharts** — Gráficas del dashboard admin
- **Inter** (Google Fonts) — Tipografía

### Backend
- **Express 4** — Framework web
- **PostgreSQL 16** — Base de datos relacional (pg)
- **argon2** — Hashing de contraseñas (argon2id, ganador PHC)
- **multer** — Subida de archivos
- **dotenv** — Variables de entorno

### Infraestructura
- **Docker Compose** — Orquestación de 4 servicios
- **nginx:alpine** — Reverse proxy con TLS
- **postgres:16-alpine** — Base de datos

## Frontend — Diseño UI

### Glassmorphism + Micro-interacciones
- Tarjetas con `backdrop-blur` y bordes con degradado sutil
- Entrada escalonada de productos con Framer Motion
- Hover con elevación animada
- Botón "Agregar al Carrito" con animación de check al agregar
- Carrito lateral con slide-in/out (spring physics)
- Skeleton loading screens con shimmer

### Componentes Nuevos
- **ProductCard** — Tarjeta de producto con detección de marca (Apple, Dell, HP, Lenovo, ASUS), logo SVG, animaciones
- **SkeletonCard** — Placeholder de carga con shimmer
- **SecurityBadge** — Indicador "Secure" con punto pulsante en el header
- **PasswordStrength** — Barra de fuerza de contraseña en tiempo real (5 niveles)

## Backend — API REST

### Endpoints

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| GET | /api/productos | No | Listar productos (filtros: busqueda, categoria, orden) |
| GET | /api/productos/:id | No | Obtener producto por ID |
| POST | /api/productos | Admin | Crear producto |
| PUT | /api/productos/:id | Admin | Actualizar producto |
| DELETE | /api/productos/:id | Admin | Eliminar producto |
| POST | /api/pedidos | No | Crear pedido (rate limited) |
| GET | /api/pedidos | Admin | Listar pedidos |
| GET | /api/pedidos/:id | Admin | Obtener pedido con items |
| POST | /api/login | No | Autenticar (rate limited: 5/15min) |
| POST | /api/logout | Token | Cerrar sesion |
| GET | /api/usuario | Token | Datos del usuario autenticado |
| POST | /api/usuario/avatar | Token | Subir avatar |
| GET | /api/admin/pedidos | Admin | Listar pedidos |
| DELETE | /api/admin/pedidos/:id | Admin | Eliminar pedido |

### Base de Datos — PostgreSQL

Tablas: `productos`, `pedidos`, `pedido_items`, `usuarios`

Usuarios de ejemplo:

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | admin |
| user | user123 | standard |

> Las contrasenas se almacenan como hashes argon2id, nunca en texto plano.

## Autenticacion y RBAC

| Accion | standard | admin |
|--------|----------|-------|
| Ver productos | Si | Si |
| Hacer pedidos | Si | Si |
| Panel admin | No | Si |
| CRUD productos | No | Si |
| Eliminar pedidos | No | Si |

Flujo: `POST /api/login` -> token -> `Authorization: <token>` -> `POST /api/logout`

## Seguridad

- **argon2id** — Hashing de contrasenas (PHC winner, async)
- **Rate limiting** — Login (5 intentos/15min) + Checkout (10 pedidos/60s)
- **HTTPS** — TLS terminado en nginx (TLSv1.2/1.3)
- **CORS restringido** — Solo `CORS_ORIGIN` de `.env`
- **Prepared statements** — Parametros `$1, $2...` (pg), prevencion SQL injection
- **Tokens criptograficos** — `crypto.randomBytes(32)` (256 bits)
- **Headers de seguridad** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options, Referrer-Policy
- **Validacion de uploads** — Solo imagenes, limites de tamano
- **21 vulnerabilidades documentadas** — Ver `correcciones_seguridad.md`

## Ejecucion

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
| Web (HTTP -> redirige) | http://localhost |
| Frontend directo | http://localhost:3000 |
| Backend directo | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado (desarrollo). En produccion usar Let's Encrypt.

### Manual

```bash
# Backend
cd backend && npm install && npm start

# Frontend
cd frontend && npm install && npm run dev
```

Requiere PostgreSQL corriendo en localhost:5432 con las credenciales de `backend/.env`.

---

*Ultima actualizacion: 19/03/2026*
