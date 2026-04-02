# Kratamex

![CI](https://github.com/DariodelBarrio/Proyecto_web/actions/workflows/ci.yml/badge.svg)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=alert_status)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=coverage)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=bugs)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)

Kratamex es una aplicacion web full-stack de e-commerce construida alrededor de un catalogo de productos, carrito, pagos, panel de administracion y un Security Operations Center (SOC) independiente para monitorizacion de eventos de seguridad.

El proyecto esta organizado como un entorno de desarrollo completo, con frontend, backend, persistencia en PostgreSQL y soporte para paneles separados de administracion y SOC.

## Que incluye

- Una tienda con catalogo, filtros, busqueda, favoritos y carrito persistente.
- Flujo de pago con Stripe mediante `PaymentIntent` y webhook.
- Autenticacion con tokens de sesion opacos generados en backend.
- Panel de administracion con operaciones CRUD, analitica y auditoria.
- Panel SOC con metricas, eventos, bloqueo de IPs y consulta de threat intel.
- Tests en frontend y backend.

## Estado del repositorio

Este repositorio no debe contener bases de datos locales ni artefactos SQLite.

- `tienda.db` y cualquier fichero `*.db`, `*.sqlite` o `*.sqlite3` se consideran residuos de desarrollo.
- La persistencia soportada para la aplicacion es PostgreSQL.
- Las bases locales deben mantenerse fuera de Git.

## Stack principal

### Frontend

- React 19
- TypeScript
- Vite 8
- TanStack Query
- Framer Motion
- React Router
- Zod
- Recharts

### Backend

- Hono
- Drizzle ORM
- PostgreSQL 16
- argon2id
- Zod
- Stripe Node SDK
- Cloudinary

### Infraestructura

- Docker Compose
- nginx
- GitHub Actions
- SonarCloud
- Gitleaks

## Autenticacion

La aplicacion principal usa tokens de sesion opacos de 256 bits generados en backend y almacenados en memoria del proceso. En el estado actual del proyecto no se usan JWT para las sesiones de usuario.

El SOC tiene su propio flujo de autenticacion y sus propias credenciales, separado del acceso del panel de administracion.

## Accesos principales

| Ruta | Descripcion | Acceso |
|---|---|---|
| `/` | Catalogo principal | Publico |
| `/producto/:id` | Detalle de producto | Publico |
| `/login` | Acceso a la aplicacion principal | Publico |
| `/registro` | Registro de clientes | Publico |
| `/perfil` | Perfil del usuario | Usuario autenticado |
| `/mis-pedidos` | Historial de pedidos | Usuario autenticado |
| `/admin` | Panel de administracion | Admin |
| `/panel` | Security Operations Center | SOC admin |

## Capturas de interfaz

Las capturas deben guardarse en `docs/screenshots/` para que GitHub las renderice correctamente en este `README`.

Archivos esperados:

- `docs/screenshots/home-catalogo.png`
- `docs/screenshots/admin-login.png`
- `docs/screenshots/admin-dashboard.png`
- `docs/screenshots/soc-login.png`
- `docs/screenshots/soc-panel.png`

## Endpoints destacados

### Aplicacion principal

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/productos` | Lista de productos |
| GET | `/api/productos/:id` | Detalle de producto |
| POST | `/api/login` | Login de la aplicacion principal |
| POST | `/api/register` | Registro de clientes |
| POST | `/api/logout` | Cierre de sesion |
| GET | `/api/usuario` | Usuario autenticado |
| PUT | `/api/usuario/perfil` | Actualizacion de perfil |
| PUT | `/api/usuario/password` | Cambio de contrasena |
| GET | `/api/mis-pedidos` | Pedidos del usuario |

### SOC

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/security/login` | Login independiente del SOC |
| POST | `/api/security/logout` | Logout independiente del SOC |
| GET | `/api/security/stats` | Metricas del SOC |
| GET | `/api/security/events` | Eventos de seguridad |

## Puesta en marcha

### Docker Compose

Importante: `docker-compose.yml`, `.env.example` y `backend/.env.example` estan preparados solo para desarrollo local. No deben reutilizarse como configuracion de produccion.

```bash
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up --build -d
```

Servicios esperados en local:

| Servicio | URL |
|---|---|
| Web HTTPS | https://localhost |
| Web HTTP | http://localhost:3000 |
| Backend | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

### Ejecucion manual

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Credenciales de desarrollo

El repositorio no documenta credenciales demo fijas para uso general.

Las cuentas iniciales dependen de tus variables de entorno locales:

- `ADMIN_USER` / `ADMIN_PASS`
- `USER_STANDARD` / `USER_PASS`
- `SOC_ADMIN_USER` / `SOC_ADMIN_PASS`

Aunque sea un entorno local, usa valores no triviales.

## Variables de entorno

Los archivos `.env.example` y `backend/.env.example` son plantillas orientadas a desarrollo local. Sirven como referencia de estructura, no como configuracion endurecida ni como ejemplo valido para produccion.

## Estructura del proyecto

```text
proyecto/
|-- frontend/
|-- backend/
|-- nextjs/
|-- nginx/
|-- docker-compose.yml
|-- README.md
```
