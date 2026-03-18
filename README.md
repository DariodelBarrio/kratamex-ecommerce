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
Página principal con catálogo de productos, búsqueda y filtros.

**Funcionalidades:**
- Listado de productos desde API
- **Búsqueda** por nombre, descripción o categoría
- **Filtro** por categoría
- **Ordenamiento** por precio (asc/desc)
- Carrito de compras (agregar, quitar, modificar cantidad)
- Checkout con formulario de cliente
- **Panel de administración** (/admin) - Requiere contraseña
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

**Seed:** Se insertan 8 productos de ejemplo al iniciar.

### Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | /api/productos   | Listar todos los productos |
| GET    | /api/productos/:id | Obtener producto por ID   |
| POST   | /api/productos   | Crear producto              |
| PUT    | /api/productos/:id | Actualizar producto         |
| DELETE | /api/productos/:id | Eliminar producto           |
| GET    | /api/pedidos     | Listar pedidos              |
| GET    | /api/pedidos/:id | Obtener pedido con items    |
| POST   | /api/pedidos     | Crear nuevo pedido          |
| POST   | /api/login       | Autenticar administrador    |

## Autenticación

El panel de administración (`/admin`) está protegido por contraseña. La autenticación se realiza a través del endpoint `/api/login` en el backend.

- **Contraseña**: `admin123`
- La sesión es temporal y se pierde al cerrar el navegador.

## Ejecución

### Con Docker
**Nota:** La construcción de las imágenes de Docker puede fallar debido a problemas de red. Si esto ocurre, se recomienda utilizar el método de ejecución manual.

```bash
docker-compose up --build
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Manual
Este es el método recomendado si Docker presenta problemas de red.

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```
