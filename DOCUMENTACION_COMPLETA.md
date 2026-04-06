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
11. Estado validado actual
12. Guia de desarrollo

---

## Vision general

Kratamex es una aplicacion full-stack de e-commerce construida con React 19, Hono y PostgreSQL. El proyecto incluye:

- tienda principal para clientes
- panel de administracion para operativa de negocio
- panel SOC para observabilidad y respuesta basica ante eventos de seguridad

En el estado actual, la aplicacion trabaja con sesiones opacas persistidas, rate limiting persistido, auditoria de acciones administrativas y un panel SOC separado del dominio funcional de tienda.

### Funcionalidades principales

- catalogo con filtros, busqueda, favoritos y carrito persistente
- checkout con validacion server-side
- integracion Stripe
- perfil de usuario con cambio de contrasena y avatar
- historial de pedidos
- panel admin con CRUD, analitica, auditoria y exportaciones
- panel SOC con metricas, eventos, bloqueo manual y exportacion
- tests backend y frontend con Vitest

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
| Seguridad | argon2id + Zod + rate limiting persistido |
| Infraestructura local | Docker Compose + nginx |
| CI | GitHub Actions + SonarCloud + Gitleaks + autofix SonarCloud |

---

## Arquitectura del sistema

```text
Usuario
  |- https://localhost -> nginx:443
  |- http://localhost:3000 -> frontend directo en desarrollo
  `- http://localhost:3001 -> backend directo en desarrollo

nginx
  |- /api/*      -> backend:3001
  |- /uploads/*  -> backend:3001
  |- /avatars/*  -> backend:3001
  `- /*          -> frontend:3000

backend
  |- dominio de tienda
  |- dominio admin
  |- dominio SOC
  |- sesiones persistidas
  `- acceso a PostgreSQL

postgres
  |- base principal
  |- base clientes
  `- base SOC
```

### Servicios Docker

| Servicio | Puerto | Rol |
|---|---|---|
| `frontend` | 3000 | Vite dev server con HMR |
| `backend` | 3001 | API Hono |
| `postgres` | 5432 | motor PostgreSQL |
| `nginx` | 80 / 443 | reverse proxy HTTPS |

### Separacion de persistencia

El backend trabaja con tres bases diferenciadas sobre PostgreSQL:

- base principal: productos, pedidos, usuarios, auditoria, favoritos, valoraciones, sesiones y rate limiting
- base clientes: `client_users` y soporte de sincronizacion de credenciales
- base SOC: `soc_admins`

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
| `/producto/:id` | detalle producto | publico |
| `/login` | auth | publico |
| `/registro` | auth | publico |
| `/perfil` | perfil | autenticado |
| `/mis-pedidos` | historial | autenticado |
| `/admin` | panel admin | admin |
| `/panel` | panel SOC | soc admin |

### Notas de implementacion

- las vistas pesadas cargan con `lazy` y `Suspense`
- el flujo de login principal persiste estado de sesion a traves de `App.tsx`
- el panel SOC consume `/api/panel/*`
- el proyecto frontend activo es `frontend/`

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
|-- security-state.ts
|-- app.ts
`-- index.ts
```

### Middlewares relevantes

| Middleware | Funcion |
|---|---|
| `generalRateLimiter` | limita trafico general |
| `loginRateLimiter` | limita intentos de login |
| `checkoutRateLimiter` | limita flooding de pedidos |
| `authenticate` | valida token de tienda |
| `requireTwoFactorVerified` | exige 2FA validado donde aplica |
| `requireAdmin` | exige rol admin |
| `authenticateSoc` | valida token SOC |
| `honeypotAuth` | absorbe autofill y senales de bots |

### Sesiones

El sistema usa tokens opacos, no JWT.

- sesiones de tienda persistidas en `auth_sessions`
- sesiones SOC persistidas en `auth_sessions`
- TTL de 8 horas
- rate limiting persistido en `rate_limit_counters`

### Uploads

- productos y avatares pueden almacenarse en Cloudinary
- si Cloudinary no esta configurado, se usa almacenamiento local

---

## Persistencia y bases de datos

### Base principal

Tablas relevantes:

- `productos`
- `pedido_items`
- `pedidos`
- `usuarios`
- `comentarios`
- `valoraciones`
- `favoritos`
- `cupones`
- `security_events`
- `blocked_ips`
- `audit_log`
- `auth_sessions`
- `rate_limit_counters`
- `password_reset_tokens`

### Base de clientes

Responsabilidad:

- `client_users`
- soporte de reseteo de password de cliente
- sincronizacion con capa principal

### Base SOC

Responsabilidad:

- `soc_admins`
- login independiente del panel `/panel`

### Seed local

Al arrancar en local el backend:

- verifica tablas de la base principal
- verifica base de clientes
- verifica base SOC
- crea usuarios demo definidos por variables de entorno
- inserta productos, pedidos, cupones y categorias demo si no existen

---

## API REST

### Publica

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/productos` | listado de productos |
| GET | `/api/productos/:id` | detalle de producto |
| GET | `/api/categorias` | categorias |
| POST | `/api/login` | login principal |
| POST | `/api/register` | registro |
| POST | `/api/logout` | cierre de sesion |
| POST | `/api/pedidos` | crear pedido |
| POST | `/api/cupones/validar` | validar cupon |

### Usuario autenticado

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
| POST | `/api/2fa/setup` | generar secreto y QR |
| POST | `/api/2fa/enable` | habilitar 2FA |
| POST | `/api/2fa/verify` | verificar 2FA |
| POST | `/api/2fa/disable` | deshabilitar 2FA |
| GET | `/api/2fa/status` | estado 2FA |

### Admin de tienda

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/admin/pedidos` | listado de pedidos |
| PATCH | `/api/pedidos/:id/estado` | cambio de estado |
| DELETE | `/api/admin/pedidos/:id` | borrar pedido |
| GET | `/api/admin/usuarios` | usuarios |
| GET | `/api/admin/analytics` | metricas |
| GET | `/api/admin/audit-log` | auditoria |
| GET | `/api/admin/papelera` | papelera logica |
| GET | `/api/admin/valoraciones` | moderacion valoraciones |
| GET | `/api/admin/cupones` | cupones |
| POST | `/api/admin/cupones` | crear cupon |
| DELETE | `/api/admin/cupones/:id` | eliminar cupon |
| POST | `/api/productos` | crear producto |
| PUT | `/api/productos/:id` | editar producto |
| DELETE | `/api/productos/:id` | eliminar producto |
| PATCH | `/api/productos/:id/stock` | stock / visibilidad |

### SOC

Rutas preferentes:

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/panel/login` | login SOC |
| POST | `/api/panel/logout` | logout SOC |
| GET | `/api/panel/stats` | metricas SOC |
| GET | `/api/panel/events` | eventos de seguridad |
| GET | `/api/panel/blocked-ips` | IPs bloqueadas |
| POST | `/api/panel/blocked-ips` | bloquear IP |
| DELETE | `/api/panel/blocked-ips/:ip` | desbloquear IP |
| GET | `/api/panel/events/export` | exportar eventos |
| GET | `/api/panel/ip/:ip/threat` | consulta de threat intel |

Compatibilidad:

- el backend mantiene aliases en `/api/security/*`

---

## Panel SOC

### Acceso

- UI: `http://localhost:3000/panel`
- login API: `/api/panel/login`
- token propio e independiente

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
- exportacion CSV y JSON

### Simulador de ataques

```bash
node scripts/simulate_attacks.mjs [URL] [ADMIN_PASSWORD]
node scripts/simulate_attacks.mjs http://localhost:3000 <ADMIN_PASS>
```

---

## Autenticacion y seguridad

### Modelo de autenticacion

La aplicacion principal usa tokens opacos de 256 bits:

```ts
crypto.randomBytes(32).toString('hex')
```

No se usan JWT para la sesion de usuario.

### RBAC actual

| Accion | standard | admin | soc_admin |
|---|---|---|---|
| ver tienda | si | si | no aplica |
| hacer pedidos | si | si | no |
| editar perfil | si | si | no |
| acceder a `/admin` | no | si | no |
| acceder a `/panel` | no | no | si |
| ver eventos SOC | no | no con token de tienda | si |

### Capas de seguridad

| Capa | Implementacion |
|---|---|
| Password hashing | argon2id |
| Validacion | Zod |
| SQL safety | Drizzle ORM |
| Sesiones | tokens opacos + TTL |
| Rate limiting | persistido por IP y por scope |
| HTTPS local | nginx + TLS |
| Cabeceras | HSTS, CSP, X-Frame-Options, nosniff |
| CORS | origenes permitidos |
| Uploads | restricciones de tipo y tamano |
| Observabilidad | `security_events` + `audit_log` |

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
SOC_DB_NAME=kratamex_soc
CLIENT_DB_NAME=kratamex_clientes
SOC_ADMIN_USER=admin
SOC_ADMIN_PASS=admin
```

```env
ADMIN_USER=admin
ADMIN_PASS=admin
USER_STANDARD=user
USER_PASS=user
```

### Servicios locales

| Servicio | URL |
|---|---|
| frontend directo | http://localhost:3000 |
| backend directo | http://localhost:3001 |
| PostgreSQL | localhost:5432 |
| nginx HTTPS | https://localhost |

Importante:

- `https://localhost` requiere `nginx/certs/cert.pem` y `nginx/certs/key.pem`
- sin certificados, el proyecto sigue siendo usable por `http://localhost:3000`
- los archivos `.env.example` son solo para desarrollo local

---

## Tests y CI

### Backend

- framework: Vitest
- estado actual: 103 tests
- build validado dentro de Docker

### Frontend

- framework: Vitest + Testing Library + jsdom
- estado actual: 296 tests
- build validado dentro de Docker

### CI

Workflow principal: `.github/workflows/ci.yml`

Jobs principales:

1. `secret-scan`
2. `test-frontend`
3. `test-backend`
4. `sonarcloud`

### Autofix SonarCloud

Workflows activos:

- `.github/workflows/sonarcloud-autofix.yml`
- `.github/workflows/groq-autofix.yml`

Ambos usan `.github/scripts/groq-autofix.mjs`.

Comportamiento actual:

- `sonarcloud-autofix.yml` acepta `repository_dispatch` para un issue concreto y tambien `workflow_dispatch`
- `groq-autofix.yml` ejecuta un barrido programado cada 4 horas
- el script intenta corregir solo archivos dentro de `frontend/src` y `backend/src`
- cada propuesta se valida con `npx tsc --noEmit` en el subproyecto afectado
- si hubo cambios validos, GitHub Actions ejecuta `npm run build` y `npm run test`
- solo se hace commit si hubo diff real y las validaciones finales pasaron

Secretos minimos:

- `SONAR_TOKEN`
- `SONAR_PROJECT_KEY`
- al menos una API key de proveedor LLM

Referencia operativa detallada:

- `docs/AUTOFIX_AUTOMATION.md`

---

## Estado validado actual

Ultima validacion funcional local:

- backend build: OK
- frontend build: OK
- backend tests: 103 OK
- frontend tests: 296 OK
- smoke tests de:
  - tienda
  - login principal
  - admin
  - SOC
  - favoritos
  - valoraciones
  - auditoria
  - 2FA basico

Hallazgos corregidos en la ultima ronda:

- login de usuario standard
- desalineaciones entre esquema Drizzle y SQL manual
- ausencia de `audit_log` en inicializacion manual
- errores de tipos en `security-state.ts`
- warnings de tests
- placeholder roto en password del panel SOC
- workflows de autofix desalineados entre si

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

```bash
docker compose restart backend
docker compose up --build -d frontend
```

### Drizzle Studio

```bash
cd backend && npm run db:studio
```

### Usuarios de ejemplo actuales

| Dominio | Usuario | Password | Rol |
|---|---|---|---|
| Tienda admin | `admin` | `admin` | admin |
| Cliente demo | `user` | `user` | standard |
| SOC | `admin` | `admin` | soc_admin |

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

Ultima actualizacion: 03/04/2026 - backend build OK - frontend build OK - 103 tests backend - 296 tests frontend - auditoria, sesiones persistidas y autofix validados
