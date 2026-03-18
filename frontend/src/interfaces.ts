// =================================================================
// TIPOS DE DATOS (INTERFACES)
// =================================================================
// Una interface define la forma de un objeto (como un plano)
// Sirve para que TypeScript помогает a detectar errores

// Interface para productos de la tienda
export interface Producto {
  id: number; // Identificador único del producto
  nombre: string; // Nombre del producto
  descripcion: string; // Descripción del producto
  precio: number; // Precio en dólares
  imagen: string; // URL de la imagen del producto
  categoria: string; // Categoría del producto
}

// Interface para items en el carrito
// Extiende Producto y le agrega la cantidad
export interface CarritoItem extends Producto {
  cantidad: number; // Cuántos de este producto hay en el carrito
}
