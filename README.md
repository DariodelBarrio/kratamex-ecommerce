# Kratamex

![CI](https://github.com/DariodelBarrio/Proyecto_web/actions/workflows/ci.yml/badge.svg)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=alert_status)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=coverage)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DariodelBarrio_Proyecto_web&metric=bugs)](https://sonarcloud.io/project/overview?id=DariodelBarrio_Proyecto_web)

Kratamex es un proyecto full-stack de e-commerce con tres superficies claramente separadas: la tienda principal para clientes, un panel de administración y un panel SOC orientado a monitorización y respuesta básica ante eventos de seguridad.

La base actual del proyecto está construida sobre React en el frontend, Hono + Drizzle en el backend y PostgreSQL como persistencia. El repositorio también incluye el entorno local de desarrollo con Docker, nginx y documentación operativa.

## Qué incluye

- Catálogo de productos con filtros, búsqueda, favoritos y carrito persistente.
- Checkout con Stripe mediante `PaymentIntent` y webhook.
- Autenticación con tokens de sesión opacos generados en backend.
- Panel de administración con operaciones CRUD, analítica y auditoría.
- Panel SOC independiente con métricas, eventos, bloqueo de IPs y threat intel.
- Cobertura de tests en frontend y backend.

## Arquitectura actual

### Frontend principal

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

### Infraestructura local

- Docker Compose
- nginx
- GitHub Actions
- SonarCloud
- Gitleaks

## Autenticación

La aplicación principal usa tokens de sesión opacos de 256 bits generados en backend y almacenados en memoria del proceso. En el estado actual del proyecto no se usan JWT para las sesiones de usuario.

El panel SOC tiene su propio flujo de autenticación y sus propias credenciales. No comparte acceso con el panel de administración ni con el login de cliente.

## Accesos principales

| Ruta | Descripción | Acceso |
|---|---|---|
| `/` | Catálogo principal | Público |
| `/producto/:id` | Detalle de producto | Público |
| `/login` | Acceso a la aplicación principal | Público |
| `/registro` | Registro de clientes | Público |
| `/perfil` | Perfil del usuario | Usuario autenticado |
| `/mis-pedidos` | Historial de pedidos | Usuario autenticado |
| `/admin` | Panel de administración | Admin |
| `/panel` | Security Operations Center | SOC admin |

## Estado del repositorio

El directorio raíz funciona como workspace de coordinación. No es una aplicación adicional: desde ahí se lanzan scripts de desarrollo, build, test y Docker para los proyectos reales, que viven en `frontend/` y `backend/`.

Este repositorio no debe contener bases de datos locales ni artefactos SQLite:

- `tienda.db` y cualquier fichero `*.db`, `*.sqlite` o `*.sqlite3` se consideran residuos de desarrollo.
- La persistencia soportada por la aplicación es PostgreSQL.
- Las bases locales deben mantenerse fuera de Git.

## Puesta en marcha

### Scripts desde la raíz

El `package.json` raíz existe para orquestar el workspace:

```bash
npm run dev:backend
npm run dev:frontend
npm run build
npm run test
npm run docker:up
```

### Docker Compose

Importante: `docker-compose.yml`, `.env.example` y `backend/.env.example` están preparados solo para desarrollo local. No deben reutilizarse como configuración de producción.

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

### Ejecución manual

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Credenciales de desarrollo

El repositorio no publica credenciales demo fijas para uso general.

Las cuentas iniciales dependen de tus variables de entorno locales:

- `ADMIN_USER` / `ADMIN_PASS`
- `USER_STANDARD` / `USER_PASS`
- `SOC_ADMIN_USER` / `SOC_ADMIN_PASS`

Aunque sea un entorno local, conviene usar valores no triviales.

## Variables de entorno

Los archivos `.env.example` y `backend/.env.example` son plantillas de desarrollo local. Sirven como referencia de estructura, no como configuración endurecida ni como ejemplo válido para producción.

## Endpoints destacados

### Aplicación principal

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/productos` | Lista de productos |
| GET | `/api/productos/:id` | Detalle de producto |
| POST | `/api/login` | Login de la aplicación principal |
| POST | `/api/register` | Registro de clientes |
| POST | `/api/logout` | Cierre de sesión |
| GET | `/api/usuario` | Usuario autenticado |
| PUT | `/api/usuario/perfil` | Actualización de perfil |
| PUT | `/api/usuario/password` | Cambio de contraseña |
| GET | `/api/mis-pedidos` | Pedidos del usuario |

### SOC

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/security/login` | Login independiente del SOC |
| POST | `/api/security/logout` | Logout independiente del SOC |
| GET | `/api/security/stats` | Métricas del SOC |
| GET | `/api/security/events` | Eventos de seguridad |

## Estructura del proyecto

```text
proyecto/
|-- frontend/                  # SPA principal en React + Vite
|-- backend/                   # API Hono + Drizzle + PostgreSQL
|-- nginx/                     # reverse proxy HTTPS para desarrollo local
|-- docs/                      # capturas, notas y documentos auxiliares
|-- scripts/                   # utilidades puntuales de validación y testing
|-- nextjs/                    # exploración paralela, no es la app principal desplegada
|-- docker-compose.yml         # stack local de desarrollo
|-- package.json               # scripts raíz para coordinar el workspace
|-- correcciones_seguridad.md  # historial de hardening y remediaciones
|-- README.md
```

## Nota sobre `nextjs/`

La carpeta `nextjs/` existe porque hubo una exploración de migración. A día de hoy no es el frontend canónico del proyecto ni la superficie que Docker sirve por defecto. La implementación principal sigue siendo `frontend/`.

## Capturas

### Catálogo principal

![Catalogo principal](docs/screenshots/home-catalogo-20260402.png)

### Panel de administración

![Panel de administracion](docs/screenshots/admin-dashboard.png)
