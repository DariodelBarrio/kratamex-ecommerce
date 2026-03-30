# Kratamex — Tienda Online Full-Stack

![CI](https://github.com/DariodelBarrio/Proyecto_web/actions/workflows/ci.yml/badge.svg)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=alert_status)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=coverage)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=bugs)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)

Aplicación web full-stack de e-commerce construida desde cero. Incluye catálogo de productos, carrito, autenticación con JWT, panel de administración, historial de pedidos y un **Security Operations Center (SOC)** propio para monitorización de amenazas en tiempo real.

---

## Características principales

- **Tienda completa** — catálogo con filtros, búsqueda, favoritos, cupones de descuento y carrito persistente
- **Pagos con Stripe** — modal de pago con PaymentElement (tarjeta, Klarna, Amazon Pay…), PaymentIntent + webhook para confirmar estado
- **Autenticación segura** — tokens de 256 bits, argon2id, rate limiting con bloqueo automático, 2FA TOTP, recuperación de contraseña
- **Panel Admin** — CRUD de productos, pedidos, reseñas, cupones y usuarios; exportación CSV; dashboard con KPIs y gráficas; registro de auditoría
- **SOC Panel** — Centro de operaciones de seguridad con métricas en tiempo real, log de eventos, detección de fuerza bruta e integración VirusTotal
- **ChatBot** — Asistente flotante con respuestas automáticas sobre envíos, devoluciones, pagos y productos
- **Menú de usuario** — Dropdown accesible con avatar, nombre, accesos rápidos y cierre de sesión
- **Tests** — 296 tests en frontend + 103 tests de integración en backend (sin BD real requerida)
- **CI/CD** — GitHub Actions con escaneo de secrets (Gitleaks), typecheck, cobertura y SonarCloud (cada 4 h)
- **Containerizado** — Docker Compose con 4 servicios: frontend, backend, PostgreSQL y nginx TLS

---

## Stack tecnológico

### Frontend
| Tecnología | Uso |
|---|---|
| React 19 + TypeScript | Framework UI |
| Vite 8 | Build tool con HMR |
| TanStack Query v5 | Caché y estados de carga |
| Framer Motion | Animaciones y micro-interacciones |
| React Router v6 | Routing SPA |
| Zod | Validación de formularios client-side |
| Recharts | Gráficas en Admin y SOC |
| Stripe.js + React Stripe.js | Modal de pago con PaymentElement |
| Vitest + Testing Library | 296 tests |

### Backend
| Tecnología | Uso |
|---|---|
| Hono | Framework web TypeScript-native |
| Drizzle ORM | ORM type-safe con queries parametrizadas |
| PostgreSQL 16 | Base de datos relacional |
| argon2id | Hashing de contraseñas |
| Zod | Validación de requests por ruta |
| Stripe Node.js SDK | PaymentIntents + verificación de webhooks |
| Cloudinary | CDN de imágenes (fallback local) |
| Vitest | 103 tests de integración |

### Infraestructura
| Tecnología | Uso |
|---|---|
| Docker Compose | Orquestación de 4 servicios |
| nginx:alpine | Reverse proxy con TLS 1.2/1.3 |
| GitHub Actions | CI automático en cada push |
| SonarCloud | Análisis estático de calidad y cobertura |
| Gitleaks | Escaneo de secrets en cada commit |

---

## Seguridad

Este proyecto pone especial atención a la seguridad, tanto en el diseño del backend como en la monitorización activa:

| Medida | Detalle |
|---|---|
| **argon2id** | Hashing de contraseñas con salt aleatorio |
| **Rate limiting** | Login: 12 intentos → bloqueo 60 s; Pedidos: 10/60 s; General: 60/min |
| **Queries parametrizadas** | Drizzle ORM elimina concatenación SQL (anti-SQLi) |
| **Tokens criptográficos** | `crypto.randomBytes(32)`, 256 bits, TTL 8 h |
| **TLS 1.2/1.3** | Terminado en nginx |
| **Security headers** | HSTS, CSP, X-Frame-Options, X-Content-Type-Options |
| **CORS restringido** | Solo el origen configurado en `.env` |
| **SOC logging** | Todos los eventos de seguridad persisten en PostgreSQL |
| **Anti-enumeración** | Recuperación de contraseña responde igual exista o no el email |
| **Gitleaks** | Bloquea el push si detecta credenciales expuestas |

### SOC Panel (`/panel`)

Panel de ciberseguridad con estética terminal. Requiere rol admin.

**Métricas en tiempo real:**
- Nivel de amenaza: BAJO / MEDIO / ALTO / CRÍTICO
- Fallos de login, ataques de fuerza bruta, tokens inválidos (últimas 24 h)
- Top 10 IPs por número de eventos
- AreaChart de actividad por hora y BarChart de IPs

**Eventos monitorizados:**

| Tipo | Descripción |
|---|---|
| `login_ok` | Autenticación exitosa |
| `login_fail` | Credenciales incorrectas |
| `brute_force` | IP bloqueada tras ≥ 12 intentos |
| `auth_invalid` | Token no válido o expirado |
| `register` | Nuevo registro de usuario |
| `forbidden` | Acceso a ruta sin permisos |

**Simulador de ataques:**
```bash
node simulate_attacks.mjs http://localhost:3000 <password_admin>
```
Genera fallos de login masivos, fuerza bruta desde IP fija, tokens inválidos y escaneo de rutas sensibles — útil para poblar el SOC con datos reales.

---

## Páginas y rutas

| Ruta | Descripción | Auth |
|---|---|---|
| `/` | Catálogo con filtros, búsqueda, carrito y favoritos | No |
| `/producto/:id` | Detalle de producto + reseñas con estrellas | No |
| `/login` | Autenticación de usuario | No |
| `/registro` | Registro de nuevo usuario | No |
| `/perfil` | Perfil editable + cambio de contraseña | Usuario |
| `/mis-pedidos` | Historial de pedidos con desglose | Usuario |
| `/admin` | Panel de administración completo | Admin |
| `/panel` | Security Operations Center | Admin |

---

## Panel de Administración (`/admin`)

| Pestaña | Funcionalidad |
|---|---|
| **Dashboard** | KPIs, gráficas AreaChart/LineChart, top productos, alertas de stock bajo, exportación CSV |
| **Productos** | CRUD completo, subida de imagen drag-and-drop (JPG/PNG/WEBP, máx. 5 MB), gestión de stock inline |
| **Pedidos** | Listado, cambio de estado (pendiente → entregado → cancelado), exportación CSV |
| **Reseñas** | Todas las valoraciones con opción de borrado |
| **Cupones** | CRUD de cupones (% o importe fijo, fecha de validez, usos máximos) |
| **Usuarios** | Listado con rol, email, pedidos totales y fecha de registro |
| **Auditoría** | Log inmutable de todas las acciones administrativas con badges por tipo |

---

## API REST — Endpoints principales

### Públicos / usuario autenticado

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/productos` | Listar productos (filtros: búsqueda, categoría, precio, stock) |
| GET | `/api/productos/:id` | Detalle de producto |
| POST | `/api/login` | Autenticar (rate limited) |
| POST | `/api/register` | Registrar usuario |
| POST | `/api/logout` | Cerrar sesión |
| GET | `/api/usuario` | Datos del usuario autenticado |
| PUT | `/api/usuario/perfil` | Actualizar perfil |
| PUT | `/api/usuario/password` | Cambiar contraseña (verifica la actual) |
| GET | `/api/mis-pedidos` | Pedidos del usuario |
| POST/DELETE | `/api/favoritos/:id` | Gestión de favoritos |
| POST | `/api/cupones/validar` | Validar cupón |
| POST | `/api/chat` | Chatbot de soporte (rate limited) |

### Pagos — Stripe

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/pedidos/checkout` | Crea pedido + PaymentIntent; devuelve `clientSecret` |
| POST | `/api/webhook` | Webhook Stripe — marca pedido como `pagado` al recibir `payment_intent.succeeded` |

**Tarjetas de test:**

| Número | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago aprobado |
| `4000 0000 0000 9995` | Fondos insuficientes |

Fecha `12/34` · CVC `123` · CP `12345`

### Administración

| Método | Ruta | Descripción |
|---|---|---|
| POST/PUT/DELETE | `/api/productos` | CRUD de productos |
| GET | `/api/admin/pedidos` | Todos los pedidos |
| PATCH | `/api/pedidos/:id/estado` | Cambiar estado del pedido |
| GET | `/api/admin/analytics` | Métricas del dashboard |
| GET | `/api/admin/usuarios` | Listado de usuarios |
| GET/POST/DELETE | `/api/admin/cupones` | CRUD de cupones |
| GET | `/api/security/stats` | Métricas SOC (24 h) |
| GET | `/api/security/events` | Log de eventos de seguridad |

---

## Tests

### Frontend — 296 tests (Vitest + Testing Library)

```bash
cd frontend && npm run test:run
```

Cubren: componentes de UI, validaciones de formulario, lógica de carrito, autenticación, panel admin, SOC dashboard, rutas protegidas y utilidades.

### Backend — 103 tests de integración (Vitest + Hono)

```bash
cd backend && npm test
cd backend && npm run test:coverage
```

| Caso de prueba | Resultado |
|---|---|
| Credenciales incorrectas | 401 |
| Login correcto | 200 + token |
| 12 fallos desde misma IP | 429 rate limit |
| Token válido | 200 + datos usuario |
| Sin token | 401 |
| Token standard en ruta admin | 403 |
| Precio manipulado en pedido | Precio ignorado, total calculado desde BD |
| Email no registrado en recuperación | 200 (anti-enumeración) |

> El backend no necesita PostgreSQL para los tests: la BD se mockea con Vitest.

### CI (GitHub Actions)

En cada push a `main`:

1. `secret-scan` — Gitleaks escanea el historial completo (bloquea si encuentra secrets)
2. `test-frontend` — typecheck + Vitest + cobertura lcov
3. `test-backend` — typecheck + Vitest + cobertura lcov
4. `quality` — SonarCloud con análisis estático y cobertura agregada

---

## Ejecución

### Con Docker (recomendado)

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build -d
```

| Servicio | URL |
|---|---|
| Web (HTTPS) | https://localhost |
| Web (HTTP) | http://localhost:3000 |
| Backend | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

> El certificado SSL es autofirmado. En producción usar Let's Encrypt.

### Manual

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (otra terminal)
cd frontend && npm install && npm run dev
```

### Usuarios de prueba

| Username | Password | Rol |
|---|---|---|
| `admin` | `admin` | Admin |
| `user` | `admin` | Usuario |

> Contraseñas almacenadas como hashes argon2id — nunca en texto plano.

### Cloudinary (opcional)

Sin configurar, las imágenes se guardan localmente en `src/uploads/` y `src/avatars/`.

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

---

## Estructura del proyecto

```
proyecto/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Admin/           # Panel de administración
│   │   │   ├── SecurityDashboard.tsx  # SOC
│   │   │   ├── ChatBot.tsx            # Chatbot flotante de soporte
│   │   │   ├── BrandCarousel.tsx      # Carrusel de marcas draggable
│   │   │   ├── Auth.tsx               # Login / Registro
│   │   │   ├── ProductCard.tsx        # Tarjeta de producto
│   │   │   ├── ProductoDetalle.tsx    # Página de detalle + reseñas
│   │   │   ├── OrderHistory.tsx       # Historial de pedidos
│   │   │   ├── UserProfile.tsx        # Perfil editable
│   │   │   └── ...
│   │   ├── test/                # 296 tests
│   │   ├── App.tsx              # Router + tienda principal
│   │   ├── api.ts               # Fetch centralizado
│   │   ├── i18n.ts              # Internacionalización (es/en)
│   │   └── interfaces.ts        # Tipos TypeScript
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── index.ts             # Servidor Hono + rutas + middlewares
│   │   ├── schemas.ts           # Validación Zod
│   │   ├── db/
│   │   │   ├── schema.ts        # Drizzle ORM schema
│   │   │   └── index.ts         # Conexión BD
│   │   └── __tests__/           # 23 tests de integración
│   └── Dockerfile
├── .github/workflows/
│   └── ci.yml                   # Pipeline CI completo
├── nginx/                       # Reverse proxy HTTPS
├── docker-compose.yml           # 4 servicios
├── simulate_attacks.mjs         # Generador de eventos SOC
└── sonar-project.properties
```

---

*Última actualización: 29/03/2026 — 296 tests frontend · 103 tests backend · ChatBot · menú de usuario · SOC panel · CI/CD completo*
