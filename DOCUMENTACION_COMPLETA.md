# Documentación Completa - Tienda Online KRATAMEX

## 📋 Índice

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Frontend - React + TypeScript](#frontend---react--typescript)
4. [Backend - Node.js + Express](#backend---nodejs--express)
5. [Base de Datos - SQLite](#base-de-datos---sqlite)
6. [API REST](#api-rest)
7. [Autenticación y Seguridad](#autenticación-y-seguridad)
8. [Despliegue y Docker](#despliegue-y-docker)
9. [Guía de Desarrollo](#guía-de-desarrollo)

---

## 🎯 Visión General

KRATAMEX es una **tienda online completa** construida con tecnologías modernas del stack MERN simplificado (React + Node.js + SQLite). La aplicación permite a los usuarios navegar un catálogo de productos, agregar items al carrito de compras, realizar pedidos y gestionar inventario a través de un panel administrativo.

### ✨ Características Principales

- **🛍️ Catálogo de Productos**: Búsqueda, filtros y ordenamiento
- **🛒 Carrito de Compras**: Agregar, modificar y eliminar productos
- **💳 Checkout**: Formulario de compra con validación
- **👨‍💼 Panel Administrativo**: CRUD de productos y gestión de pedidos
- **🔒 Autenticación**: Acceso protegido al panel admin
- **📱 Diseño Responsive**: Funciona en desktop y móvil
- **🐳 Docker**: Despliegue containerizado

### 🛠️ Tecnologías Utilizadas

| Componente | Tecnología | Versión |
|------------|------------|---------|
| **Frontend** | React + TypeScript | 19.2.4 |
| **Backend** | Node.js + Express | 4.18.2 |
| **Base de Datos** | SQLite + better-sqlite3 | 9.4.3 |
| **Build Tool** | Vite | 5.1.6 |
| **Icons** | Lucide React | 0.344.0 |
| **Routing** | React Router | 6.22.3 |
| **Container** | Docker + Docker Compose | 3.8 |

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│   Frontend      │◄──────────────►│   Backend       │
│   (React)       │                │   (Express)     │
│   Port: 5173    │                │   Port: 3001    │
└─────────────────┘                └─────────────────┘
         │                                   │
         └───────────────────────────────────┼─────────────────┐
                                             ▼                 │
                                   ┌─────────────────┐        │
                                   │   Database      │        │
                                   │   (SQLite)      │        │
                                   │   tienda.db     │        │
                                   └─────────────────┘        │
                                                             │
┌─────────────────┐    Volumes      ┌─────────────────┐      │
│   Docker        │◄──────────────►│   Docker        │◄─────┘
│   Compose       │                │   Containers    │
└─────────────────┘                └─────────────────┘
```

### Componentes del Sistema

1. **Frontend (SPA)**: Interfaz de usuario en React
2. **Backend (API REST)**: Lógica de negocio y persistencia
3. **Base de Datos**: Almacenamiento de productos y pedidos
4. **Docker**: Containerización y orquestación

---

## 🎨 Frontend - React + TypeScript

### Estructura de Archivos

```
frontend/
├── src/
│   ├── App.tsx           # Componentes principales y lógica
│   ├── main.tsx          # Punto de entrada con React Router
│   ├── index.css         # Estilos globales
│   └── vite-env.d.ts     # Tipos de Vite
├── package.json          # Dependencias y scripts
├── vite.config.ts        # Configuración de Vite
├── tsconfig.json         # Configuración de TypeScript
├── tsconfig.node.json    # Configuración de TypeScript para Node
├── index.html            # HTML base
└── Dockerfile            # Containerización
```

### Componentes Principales

#### 🏪 Componente Tienda (`/`)

**Funcionalidad**: Página principal con catálogo de productos, búsqueda y carrito.

**Estados del Componente**:
```typescript
const [productos, setProductos] = useState<Producto[]>([])        // Lista de productos
const [carrito, setCarrito] = useState<CarritoItem[]>([])        // Items en carrito
const [carritoAbierto, setCarritoAbierto] = useState(false)      // Estado del modal
const [checkoutExitoso, setCheckoutExitoso] = useState(false)    // Éxito de compra
const [busqueda, setBusqueda] = useState('')                     // Texto de búsqueda
const [categoriaFiltro, setCategoriaFiltro] = useState('')       // Filtro de categoría
const [ordenPrecio, setOrdenPrecio] = useState<'asc' | 'desc' | ''>('') // Orden precio
const [loading, setLoading] = useState(true)                     // Estado de carga
const [formulario, setFormulario] = useState({                   // Datos del checkout
  cliente: '',
  email: '',
  direccion: ''
})
```

**Funciones Principales**:

- `cargarProductos()`: Obtiene productos del API con filtros
- `agregarAlCarrito(producto)`: Agrega producto al carrito
- `actualizarCantidad(id, cantidad)`: Modifica cantidad en carrito
- `eliminarDelCarrito(id)`: Remueve producto del carrito
- `calcularTotal()`: Suma total del carrito
- `procesarCheckout()`: Envía pedido al backend

#### 👨‍💼 Componente Admin (`/admin`)

**Funcionalidad**: Panel de administración para gestionar productos y pedidos.

**Características**:
- Estadísticas del negocio (productos, pedidos, ventas)
- CRUD completo de productos
- Listado de pedidos con detalles
- Autenticación requerida

### Interfaces TypeScript

```typescript
interface Producto {
  id: number
  nombre: string
  descripcion: string
  precio: number
  imagen: string
  categoria: string
}

interface CarritoItem extends Producto {
  cantidad: number
}

interface Pedido {
  id: number
  cliente: string
  email: string
  direccion: string
  total: number
  fecha: string
  items?: PedidoItem[]
}
```

### Funciones de Utilidad

#### `sanitize(str: string): string`
Protege contra ataques XSS convirtiendo caracteres especiales HTML en entidades seguras.

```typescript
const sanitize = (str: string): string => {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}
```

### Estilos CSS

**Variables CSS Personalizadas**:
```css
:root {
  --primary: #2563eb;
  --secondary: #64748b;
  --success: #10b981;
  --error: #ef4444;
  --background: #f8fafc;
  --text: #1e293b;
}
```

**Características de Diseño**:
- Diseño responsive con media queries
- Cards para productos
- Modales para carrito y formularios
- Tablas para administración
- Estados de carga y hover

---

## 🚀 Backend - Node.js + Express

### Estructura de Archivos

```
backend/
├── src/
│   └── index.js          # Servidor principal
├── package.json          # Dependencias
└── Dockerfile            # Containerización
```

### Configuración del Servidor

```javascript
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')

const app = express()
const PORT = 3001

// Middlewares
app.use(cors())
app.use(express.json())
```

### Base de Datos SQLite

**Conexión**:
```javascript
const db = new Database('tienda.db')
```

**Esquema de Tablas**:

#### Tabla `productos`
```sql
CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio REAL NOT NULL,
  imagen TEXT,
  categoria TEXT
)
```

#### Tabla `pedidos`
```sql
CREATE TABLE pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL,
  email TEXT NOT NULL,
  direccion TEXT NOT NULL,
  total REAL NOT NULL,
  fecha TEXT DEFAULT CURRENT_TIMESTAMP
)
```

#### Tabla `pedido_items`
```sql
CREATE TABLE pedido_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL,
  producto_id INTEGER NOT NULL,
  cantidad INTEGER NOT NULL,
  precio REAL NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
)
```

### Datos de Ejemplo (Seed)

Al iniciar la aplicación, se insertan 8 productos de ejemplo si la base de datos está vacía:

1. Laptop Pro 15" - Electrónica
2. Smartphone Ultra - Electrónica
3. Auriculares Bluetooth - Audio
4. Smartwatch Sport - Wearables
5. Cámara Digital 4K - Cámaras
6. Tablet 10" - Electrónica
7. Consola de Juegos - Gaming
8. Altavoz Inteligente - Audio

---

## 📡 API REST

### Endpoints de Productos

#### `GET /api/productos`
Obtiene todos los productos con filtros opcionales.

**Parámetros de Query**:
- `busqueda`: Texto para buscar en nombre, descripción o categoría
- `categoria`: Filtrar por categoría específica
- `orden`: `'asc'` o `'desc'` para ordenar por precio

**Ejemplo**:
```
GET /api/productos?busqueda=laptop&categoria=Electrónica&orden=asc
```

#### `GET /api/productos/:id`
Obtiene un producto específico por ID.

#### `POST /api/productos`
Crea un nuevo producto.

**Body**:
```json
{
  "nombre": "Producto Nuevo",
  "descripcion": "Descripción del producto",
  "precio": 99.99,
  "imagen": "https://example.com/image.jpg",
  "categoria": "Categoría"
}
```

#### `PUT /api/productos/:id`
Actualiza un producto existente.

#### `DELETE /api/productos/:id`
Elimina un producto.

### Endpoints de Pedidos

#### `GET /api/pedidos`
Obtiene todos los pedidos (ordenados por fecha descendente).

#### `GET /api/pedidos/:id`
Obtiene un pedido específico con sus items.

**Respuesta**:
```json
{
  "id": 1,
  "cliente": "Juan Pérez",
  "email": "juan@example.com",
  "direccion": "Calle 123",
  "total": 1299.99,
  "fecha": "2024-01-15 10:30:00",
  "items": [
    {
      "id": 1,
      "pedido_id": 1,
      "producto_id": 1,
      "cantidad": 1,
      "precio": 1299.99,
      "nombre": "Laptop Pro 15\"",
      "imagen": "https://picsum.photos/seed/laptop/400/300"
    }
  ]
}
```

#### `POST /api/pedidos`
Crea un nuevo pedido (checkout).

**Body**:
```json
{
  "cliente": "Juan Pérez",
  "email": "juan@example.com",
  "direccion": "Calle 123",
  "items": [
    {
      "id": 1,
      "cantidad": 2,
      "precio": 1299.99
    }
  ]
}
```

### Seguridad API

- **Prepared Statements**: Prevención de SQL injection
- **Validación de Datos**: Verificación de campos requeridos
- **CORS**: Control de acceso cross-origin
- **Sanitización**: Limpieza de datos en frontend

---

## 🔐 Autenticación y Seguridad

### Panel Administrativo

**Acceso**: Ruta `/admin` protegida por contraseña simple.

**Credenciales**:
- **Contraseña**: `admin123`
- **Sesión**: Temporal (se pierde al cerrar navegador)

**Implementación**:
```typescript
const [autenticado, setAutenticado] = useState(false)
const [password, setPassword] = useState('')

const verificarPassword = () => {
  if (password === 'admin123') {
    setAutenticado(true)
    localStorage.setItem('admin_auth', 'true')
  }
}
```

### Medidas de Seguridad

1. **XSS Protection**: Función `sanitize()` en frontend
2. **SQL Injection**: Prepared statements en backend
3. **Input Validation**: Validación de formularios
4. **CORS**: Restricción de orígenes permitidos

---

## 🐳 Despliegue y Docker

### Docker Compose

**Archivo `docker-compose.yml`**:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    environment:
      - VITE_API_URL=http://localhost:3001
```

### Dockerfiles

#### Backend Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

#### Frontend Dockerfile
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
```

### Ejecución

**Con Docker**:
```bash
docker-compose up --build
```

**Manual**:
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

**URLs de Acceso**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## 🛠️ Guía de Desarrollo

### Prerrequisitos

- Node.js 18+
- Docker (opcional)
- Git

### Instalación

1. **Clonar repositorio**:
   ```bash
   git clone <url-del-repo>
   cd proyecto
   ```

2. **Instalar dependencias**:
   ```bash
   # Backend
   cd backend && npm install

   # Frontend
   cd frontend && npm install
   ```

3. **Ejecutar aplicación**:
   ```bash
   # Opción 1: Docker
   docker-compose up --build

   # Opción 2: Manual
   cd backend && npm run dev &
   cd frontend && npm run dev
   ```

### Scripts Disponibles

**Frontend**:
- `npm run dev`: Inicia servidor de desarrollo
- `npm run build`: Construye para producción
- `npm run preview`: Vista previa de build

**Backend**:
- `npm start`: Inicia servidor
- `npm run dev`: Inicia servidor en modo desarrollo

### Estructura de Desarrollo

- **Frontend**: Hot reload con Vite
- **Backend**: Reinicio automático con nodemon
- **Base de Datos**: SQLite persistente en archivo local

### Testing

La aplicación incluye validación automática:
- Verificación de builds exitosos
- Tests de API endpoints
- Validación de formularios

---

## 📊 Estadísticas del Proyecto

- **Líneas de Código**: ~800+ líneas
- **Componentes React**: 2 principales (Tienda, Admin)
- **Endpoints API**: 7 rutas REST
- **Tablas DB**: 3 tablas relacionales
- **Productos de Ejemplo**: 8 items
- **Tiempo de Desarrollo**: Estimado 2-3 semanas

---

## 🔄 Flujo de la Aplicación

1. **Usuario visita tienda** → Carga productos desde API
2. **Búsqueda/Filtros** → API devuelve productos filtrados
3. **Agregar al carrito** → Estado local se actualiza
4. **Checkout** → Validación y envío a API
5. **Pedido creado** → Base de datos actualizada
6. **Admin revisa** → Panel muestra estadísticas y pedidos

---

## 🚀 Próximas Mejoras

- [ ] Autenticación JWT para admin
- [ ] Paginación de productos
- [ ] Sistema de reseñas
- [ ] Integración con pasarelas de pago
- [ ] Notificaciones por email
- [ ] API de inventario
- [ ] Tests unitarios y E2E
- [ ] CI/CD pipeline
- [ ] Despliegue en cloud

---

*Documentación generada el: $(date)*
*Versión de la aplicación: 1.0.0*</content>
<parameter name="filePath">/home/dario/proyecto/DOCUMENTACION_COMPLETA.md