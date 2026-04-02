# Documentacion Completa - KRATAMEX

## Indice

1. Vision general
2. Arquitectura del sistema
3. Frontend
4. Backend
5. Persistencia y bases de datos
6. API REST
7. Panel SOC
8. Autenticacion y seguridad
9. Docker y entorno local
10. Tests y CI
11. Guia de desarrollo

---

## Vision general

Kratamex es una aplicacion full-stack de e-commerce construida con React 19, Hono y PostgreSQL. El proyecto incluye una tienda principal para clientes, un panel de administracion para la operativa de negocio y un panel SOC para observabilidad y respuesta basica ante eventos de seguridad.

En el estado actual del proyecto existen tres dominios funcionales separados:

- Aplicacion principal: tienda, pedidos, perfil y favoritos.
- Administracion: gestion de catalogo, pedidos, cupones, usuarios y auditoria.
- SOC: autenticacion propia, token propio y base de datos propia para el panel `/panel`.

### Funcionalidades principales

- Catalogo con filtros, busqueda, favoritos y carrito persistente.
- Checkout con validacion server-side y soporte para Stripe.
- Perfil de usuario con cambio de contrasena y avatar.
- Historial de pedidos.
- Panel admin con CRUD, analitica, auditoria y exportaciones.
- Panel SOC con metricas, eventos, bloqueo de IPs y exportacion.
- Tests en frontend y backend con Vitest.

### Stack principal

| Capa | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Estado servidor | TanStack Query |
| Routing | React Router |
| UI / animacion | Framer Motion + Lucide + Recharts |
| Backend | Hono sobre Node.js |
| ORM | Drizzle ORM |
| Base de datos | PostgreSQL 16 |
| Seguridad | argon2id + Zod + rate limiting |
| Infraestructura local | Docker Compose + nginx |
| CI | GitHub Actions + SonarCloud + Gitleaks |

---

## Arquitectura del sistema

```text
Usuario
  |- https://localhost -> nginx:443
  |- http://localhost  -> nginx:80 -> 301 a HTTPS
  `- http://localhost:3000 -> frontend directo en desarrollo

nginx
  |- /api/*      -> backend:3001
  |- /uploads/*  -> backend:3001
  |- /avatars/*  -> backend:3001
  `- /*          -> frontend:3000

backend
  |- logica de tienda y admin
  |- autenticacion de tienda
  |- autenticacion SOC
  |- integracion Stripe
  `- acceso a PostgreSQL

postgres
  |- base principal
  |- base de clientes
  `- base SOC
```

### Servicios Docker

| Servicio | Puerto | Rol |
|---|---|---|
| `frontend` | 3000 | Vite dev server con HMR |
| `backend` | 3001 | API Hono |
| `postgres` | 5432 | Motor PostgreSQL |
| `nginx` | 80 / 443 | Reverse proxy HTTPS |

### Separacion de persistencia

Aunque todo corre sobre el mismo motor PostgreSQL en local, el backend trabaja con tres bases diferenciadas:

- Base principal: productos, pedidos, admin, comentarios, valoraciones, auditoria y eventos.
- Base de clientes: usuarios cliente y soporte de sincronizacion de credenciales.
- Base SOC: credenciales del panel SOC (`soc_admins`) y sesiones SOC en memoria.

---

## Frontend

### Estructura principal

```text
frontend/src/
|-- components/
|   |-- Admin/Admin.tsx
|   |-- SecurityDashboard.tsx
|   |-- Auth.tsx
|   |-- UserProfile.tsx
|   |-- OrderHistory.tsx
|   |-- ProductoDetalle.tsx
|   `-- ...
|-- test/
|-- App.tsx
|-- api.ts
|-- interfaces.ts
`-- index.css
```

### Rutas principales

| Ruta | Componente | Acceso |
|---|---|---|
| `/` | tienda | publico |
| `/producto/:id` | detalle de producto | publico |
| `/login` | auth | publico |
| `/registro` | auth | publico |
| `/perfil` | perfil | usuario autenticado |
| `/mis-pedidos` | historial | usuario autenticado |
| `/admin` | admin | admin de tienda |
| `/panel` | SOC | admin SOC |

### Notas de implementacion

- Las vistas pesadas cargan en diferido con `lazy` y `Suspense`.
- El frontend principal del proyecto es `frontend/`.
- La carpeta `nextjs/` existe como exploracion paralela y no es la superficie canonica ni la que sirve Docker por defecto.

---

## Backend

### Estructura principal

```text
backend/src/
|-- __tests__/
|-- db/
|   |-- index.ts
|   `-- schema.ts
|-- 2fa.ts
|-- ip-anomaly.ts
|-- schemas.ts
`-- index.ts
```

### Middlewares relevantes

| Middleware | Funcion |
|---|---|
| `generalRateLimiter` | limita trafico general |
| `loginRateLimiter` | limita intentos de login |
| `checkoutRateLimiter` | limita flooding de pedidos |
| `authenticate` | valida token de sesion de tienda |
| `requireAdmin` | exige rol `admin` |
| `authenticateSoc` | valida token SOC |
| `honeypotAuth` | absorbe autofill y senales de bots |

### Sesiones

El sistema usa tokens opacos, no JWT.

```ts
const sessions: Record<string, SessionData> = {}
const socSessions: Record<string, SocSessionData> = {}
```

- `sessions` se usa para la aplicacion principal.
- `socSessions` se usa para el panel SOC.
- Ambas tienen TTL de 8 horas y limpieza periodica.

### Uploads

- Productos y avatares pueden ir a Cloudinary.
- Si Cloudinary no esta configurado, el backend usa almacenamiento local como fallback.

---

## Persistencia y bases de datos

### Base principal

Tablas relevantes:

- `productos`
- `pedidos`
- `pedido_items`
- `usuarios`
- `comentarios`
- `valoraciones`
- `favoritos`
- `cupones`
- `security_events`
- `blocked_ips`
- `audit_log`

### Base de clientes

Responsabilidad:

- usuarios cliente
- sincronizacion de credenciales y datos de perfil con la capa principal cuando aplica

### Base SOC

Responsabilidad:

- tabla `soc_admins`
- login independiente del panel `/panel`

### Seed local

Al arrancar en local, el backend:

- verifica tablas de la base principal
- verifica la base de clientes
- verifica la base SOC
- crea usuarios iniciales de desarrollo segun variables de entorno

---

## API REST

### Publica

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/productos` | listado de productos |
| GET | `/api/productos/:id` | detalle de producto |
| GET | `/api/categorias` | categorias |
| POST | `/api/login` | login de tienda |
| POST | `/api/register` | registro |
| POST | `/api/logout` | cierre de sesion |
| POST | `/api/pedidos` | crear pedido |
| POST | `/api/cupones/validar` | validar cupon |

### Autenticada de usuario

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/usuario` | usuario autenticado |
| PUT | `/api/usuario/perfil` | actualizar perfil |
| PUT | `/api/usuario/password` | cambiar contrasena |
| POST | `/api/usuario/avatar` | subir avatar |
| GET | `/api/mis-pedidos` | pedidos del usuario |
| GET | `/api/favoritos` | favoritos |
| POST | `/api/favoritos/:id` | anadir favorito |
| DELETE | `/api/favoritos/:id` | eliminar favorito |

### Admin de tienda

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/admin/pedidos` | listado de pedidos |
| PATCH | `/api/pedidos/:id/estado` | cambio de estado |
| DELETE | `/api/admin/pedidos/:id` | borrar pedido |
| GET | `/api/admin/usuarios` | usuarios |
| GET | `/api/admin/analytics` | metricas |
| GET | `/api/admin/audit-log` | auditoria |
| POST | `/api/productos` | crear producto |
| PUT | `/api/productos/:id` | editar producto |
| DELETE | `/api/productos/:id` | eliminar producto |
| PATCH | `/api/productos/:id/stock` | stock / visibilidad |
| POST | `/api/productos/:id/imagen` | imagen |
| GET | `/api/admin/cupones` | cupones |
| POST | `/api/admin/cupones` | crear cupon |
| DELETE | `/api/admin/cupones/:id` | eliminar cupon |

### SOC

Rutas preferentes actuales:

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/panel/login` | login SOC |
| POST | `/api/panel/logout` | logout SOC |
| GET | `/api/panel/stats` | metricas del SOC |
| GET | `/api/panel/events` | eventos de seguridad |
| GET | `/api/panel/blocked-ips` | IPs bloqueadas |
| POST | `/api/panel/blocked-ips` | bloquear IP |
| DELETE | `/api/panel/blocked-ips/:ip` | desbloquear IP |
| GET | `/api/panel/events/export` | exportar eventos |
| GET | `/api/panel/ip/:ip/threat` | consulta de threat intel |

Compatibilidad:

- El backend mantiene aliases en `/api/security/*`.
- El frontend del panel consume `/api/panel/*`.

---

## Panel SOC

### Acceso

- Ruta UI: `http://localhost:3000/panel`
- Login API: `/api/panel/login`
- Sesion: token SOC independiente

El panel SOC no comparte autenticacion con:

- `/api/login`
- `/admin`
- sesiones de usuarios cliente

### Datos que muestra

- nivel de amenaza
- fallos de login
- brute force
- tokens invalidos
- IPs unicas
- sesiones activas
- top IPs
- actividad horaria
- IPs bloqueadas
- exportacion CSV / JSON

### Simulador de ataques

```bash
node scripts/simulate_attacks.mjs [URL] [ADMIN_PASSWORD]
node scripts/simulate_attacks.mjs http://localhost:3000 <ADMIN_PASS>
```

Sirve para poblar el panel con:

- `login_ok`
- `login_fail`
- `brute_force`
- `auth_invalid`
- escaneos de rutas sensibles

---

## Autenticacion y seguridad

### Modelo de autenticacion

La aplicacion principal usa tokens de sesion opacos de 256 bits:

```ts
crypto.randomBytes(32).toString('hex')
```

No se usan JWT para la sesion de usuario.

### RBAC actual

| Accion | standard | admin | soc_admin |
|---|---|---|---|
| Ver tienda | si | si | no aplica |
| Hacer pedidos | si | si | no |
| Editar perfil | si | si | no |
| Acceder a `/admin` | no | si | no |
| Acceder a `/panel` | no | no | si |
| Ver eventos SOC | no | no con token de tienda | si |

### Capas de seguridad

| Capa | Implementacion |
|---|---|
| Password hashing | argon2id |
| Validacion | Zod |
| SQL safety | Drizzle ORM |
| Sesiones | tokens opacos + TTL |
| Rate limiting | por IP y por endpoint |
| HTTPS local | nginx + TLS |
| Cabeceras | HSTS, CSP, X-Frame-Options, nosniff |
| CORS | origenes permitidos |
| Uploads | restricciones de tipo y tamano |
| Observabilidad | `security_events` + `audit_log` |

Limitacion conocida:

- sesiones y algunos rate limiters siguen en memoria de proceso

---

## Docker y entorno local

### Arranque

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build -d
```

### Variables importantes

```env
POSTGRES_DB=kratamex
POSTGRES_USER=kratamex
POSTGRES_PASSWORD=kratamex_dev
```

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=kratamex
DB_USER=kratamex
DB_PASSWORD=kratamex_dev

CLIENT_DB_NAME=kratamex_clientes
SOC_DB_NAME=kratamex_soc
SOC_ADMIN_USER=admin
SOC_ADMIN_PASS=admin
```

### Servicios locales

| Servicio | URL |
|---|---|
| Web HTTPS | https://localhost |
| Frontend directo | http://localhost:3000 |
| Backend directo | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

Importante:

- `docker-compose.yml`, `.env.example` y `backend/.env.example` son solo para desarrollo local.
- No deben reutilizarse como configuracion de produccion.

---

## Tests y CI

### Backend

- framework: Vitest
- estilo: integracion sobre `app.request()` con mocks de DB y servicios externos
- estado actual: **103 tests**

Ejemplos validados:

- login correcto e incorrecto
- anti-enumeracion
- rate limiting de login
- permisos admin
- acceso SOC con token no valido
- validaciones Zod
- calculo de pedidos sin confiar en el precio del cliente

### Frontend

- framework: Vitest + Testing Library + jsdom
- estado actual: **296 tests**

Cobertura de componentes y rutas:

- `App`
- `Auth`
- `SecurityDashboard`
- `ProductCard`
- `PasswordStrength`
- `UserProfile`
- `OrderHistory`

### CI

Workflow principal: `.github/workflows/ci.yml`

Jobs:

1. `secret-scan`
2. `test-frontend`
3. `test-backend`
4. `sonarcloud`

Notas actuales:

- frontend y backend generan cobertura en CI
- el workflow fuerza acciones JavaScript a Node 24 para evitar la deprecacion de Node 20 en GitHub Actions

---

## Guia de desarrollo

### Scripts utiles desde la raiz

```bash
npm run dev:backend
npm run dev:frontend
npm run build
npm run test
npm run docker:up
```

### HMR y Docker

En algunos entornos Windows / Docker puede hacer falta tocar o reiniciar servicios para forzar deteccion de cambios:

```bash
docker compose restart backend
docker compose up --build -d frontend
```

### Instalar dependencias nuevas

```bash
docker compose exec backend npm install <paquete>
docker compose restart backend
```

### Drizzle Studio

```bash
cd backend && npm run db:studio
```

### Usuarios de ejemplo

Las cuentas de desarrollo dependen de variables de entorno locales.

| Dominio | Usuario | Password | Rol |
|---|---|---|---|
| Tienda/admin | `ADMIN_USER` | `ADMIN_PASS` | admin |
| Cliente | `USER_STANDARD` | `USER_PASS` | standard |
| SOC | `SOC_ADMIN_USER` | `SOC_ADMIN_PASS` | soc_admin |

### Anadir un evento SOC

```ts
logSecEvent('forbidden', {
  ip: getClientIP(c),
  username: c.get('user')?.username,
  endpoint: c.req.path,
  metodo: c.req.method,
  detalles: 'Acceso sin permisos'
})
```

### Anadir un registro de auditoria

```ts
const u = c.get('user')
await logAudit(u.id, u.username, 'actualizar', 'producto', productoId, 'Cambio de stock')
```

---

Ultima actualizacion: 02/04/2026 - 296 tests frontend - 103 tests backend - login SOC independiente - aliases `/api/panel/*` - workspace y documentacion consolidados
