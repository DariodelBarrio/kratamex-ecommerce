// =================================================================
// TIPOS DE DATOS — Kratamex Next.js
// =================================================================

export interface Producto {
  id: number
  nombre: string
  descripcion: string
  precio: number
  imagen: string
  categoria: string
  stock: number
  sku?: string
  destacado?: boolean
  activo?: boolean
  rating?: number
  numValoraciones?: number
  imagenes?: string[]
  cpu?: string
  gpu?: string
  ram?: string
  almacenamiento?: string
}

export interface CarritoItem extends Producto {
  cantidad: number
}

export interface Comentario {
  id: number
  producto_id?: number
  autor: string
  contenido: string
  fecha: string
}

export interface Valoracion {
  id: number
  puntuacion: number
  titulo: string
  comentario: string
  fecha: string
  username: string
  avatar: string | null
}

export interface Pedido {
  id: number
  cliente: string
  email: string
  direccion: string
  total: number
  subtotal?: number
  impuestos?: number
  envio?: number
  descuento?: number
  estado: string
  notas?: string
  fecha: string
  items?: PedidoItem[]
}

export interface PedidoItem {
  id: number
  productoId: number
  cantidad: number
  precio: number
  nombre: string
  imagen: string
}

export interface Usuario {
  id: number
  username: string
  email?: string
  nombre?: string
  role: string
  avatar?: string | null
  direccion?: string
  telefono?: string
  idioma?: string
}

export interface Categoria {
  id: number
  nombre: string
  descripcion?: string
  imagen?: string
  orden: number
  activa: boolean
}

export interface Cupon {
  id: number
  codigo: string
  tipo: 'porcentaje' | 'fijo'
  valor: number
  minCompra?: number
  maxUsos?: number
  usosActuales?: number
  activo: boolean
  fechaInicio?: string
  fechaFin?: string
}
