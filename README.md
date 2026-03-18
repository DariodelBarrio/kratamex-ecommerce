# Tienda Online - Documentación

## Estructura del Proyecto

```
proyecto/
├── frontend/           # Aplicación React + TypeScript + Vite
│   ├── src/
│   │   ├── components/ # Componentes reutilizables
│   │   │   └── Admin/
│   │   │       ├── Admin.tsx
│   │   │       └── Admin.module.css
│   │   ├── App.tsx     # Componente principal y de la tienda
│   │   ├── main.tsx    # Punto de entrada con React Router
│   │   ├── index.css   # Estilos globales
│   │   ├── interfaces.ts # Interfaces de TypeScript
│   │   └── utils.ts      # Funciones de utilidad
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── backend/            # API REST con Express + SQLite
│   ├── src/
│   │   └── index.js    # Servidor, rutas y base de datos
│   ├── package.json
│   ├── .dockerignore
│   └── Dockerfile
├── frontend/
│   ├── ...
│   ├── .dockerignore
│   └── Dockerfile
├── docker-compose.yml  # Orquestación de servicios
└── README.md           # Este documento
```

## Frontend

### Tecnologías
- **React 18** - Framework de UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool rápido
- **React Router** - Navegación
- **Lucide React** - Iconos (actualizado a la última versión)

### Componentes

#### Tienda (/)
Página principal con catálogo de ordenadores, búsqueda y filtros.

**Funcionalidades:**
- Listado de ordenadores desde API
- **Búsqueda** por nombre, descripción o categoría
- **Filtro** por categoría (Portátiles, Gaming, Sobremesa)
- **Filtro** por rango de precio
- **Ordenamiento** por precio (asc/desc)
- Carrito de compras (agregar, quitar, modificar cantidad)
- Checkout con formulario de cliente
- **Panel de administración** (/admin) - Requiere usuario y contraseña
- Loading state mientras cargan los productos

#### Admin (/admin)
Panel de administración para gestionar productos y pedidos.

**Funcionalidades:**
- Ver estadísticas (productos, pedidos, total ventas)
- CRUD de productos (crear, editar, eliminar)
- Listado de pedidos

### Estilos
Los estilos globales se encuentran en `index.css`. El componente `Admin` ha sido refactorizado para usar CSS Modules (`Admin.module.css`), mejorando la organización y evitando conflictos de estilos.

## Backend

### Tecnologías
- **Express** - Framework web
- **Better SQLite3** - Base de datos SQLite
- **CORS** - Cross-origin resource sharing

### Base de Datos

**Tablas:**
- `productos` - Catálogo de productos
- `pedidos` - Pedidos realizados
- `pedido_items` - Ítems de cada pedido
- `usuarios` - Usuarios del sistema (RBAC)

**Seed:** Se insertan 15 ordenadores de ejemplo, 3 pedidos de ejemplo y 2 usuarios (admin/user) al iniciar.

### Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | /api/productos   | Listar todos los productos (filtros: busqueda, categoria, desde, hasta, fechaDesde, fechaHasta, orden) |
| GET    | /api/productos/:id | Obtener producto por ID   |
| POST   | /api/productos   | Crear producto              |
| PUT    | /api/productos/:id | Actualizar producto         |
| DELETE | /api/productos/:id | Eliminar producto           |
| GET    | /api/pedidos     | Listar pedidos              |
| GET    | /api/pedidos/:id | Obtener pedido con items    |
| POST   | /api/pedidos     | Crear nuevo pedido          |
| POST   | /api/login       | Autenticar usuario (devuelve token)    |
| POST   | /api/logout      | Cerrar sesión               |
| GET    | /api/usuario     | Obtener datos del usuario autenticado |
| POST   | /api/usuario/avatar | Subir imagen de perfil   |
| GET    | /api/admin/pedidos | Listar pedidos (solo admin) |
| DELETE | /api/admin/pedidos/:id | Eliminar pedido (solo admin) |

## Autenticación y RBAC

El sistema implementa **RBAC (Role-Based Access Control)** con dos roles:
- **admin**: Acceso total, incluyendo panel de administración y gestión de pedidos
- **standard**: Usuario regular, puede ver productos y hacer pedidos

### Usuarios de ejemplo
| Username | Password | Rol     |
|----------|----------|---------|
| admin    | admin123 | admin   |
| user     | user123  | standard|

La autenticación funciona con tokens de sesión:
1. `POST /api/login` - Enviar `{username, password}` → devuelve `{token, user}`
2. Incluir `Authorization: <token>` en las peticiones protegidas
3. `POST /api/logout` - Cerrar sesión

### Rutas protegidas
- `/api/usuario` - Datos del usuario autenticado
- `/api/usuario/avatar` - Subir imagen de perfil
- `/api/admin/pedidos` - Solo admin
- `/api/admin/pedidos/:id` - Solo admin

## Ejecución

### Con Docker (recomendado)

```bash
docker compose up --build
```

En background:
```bash
docker compose up --build -d
```

| Servicio | URL |
|----------|-----|
| Web (HTTPS) | https://localhost |
| Web (HTTP → redirige) | http://localhost |
| Frontend directo | http://localhost:3000 |
| Backend directo | http://localhost:3001 |

> El certificado SSL es autofirmado. El navegador mostrará una advertencia de seguridad — es esperado en entorno de desarrollo. En producción se debe usar un certificado válido (Let's Encrypt, etc.)

nginx actúa como reverse proxy: termina TLS, redirige HTTP→HTTPS y enruta `/api/*` al backend y `/` al frontend.

### Manual

```bash
# Backend
cd backend && npm install && npm start

# Frontend
cd frontend && npm install && npm run dev
```
