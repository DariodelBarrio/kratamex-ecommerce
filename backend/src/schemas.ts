import { z } from 'zod';

// =================================================================
// PRODUCTOS
// =================================================================
export const ProductoBodySchema = z.object({
  nombre:      z.string().min(1, 'Nombre requerido').max(200),
  descripcion: z.string().max(1000).optional().default(''),
  precio:      z.number().min(0).max(999999),
  imagen:      z.string().max(500).optional().default(''),
  categoria:   z.string().max(50).optional().default(''),
  stock:       z.number().int().min(0).optional().default(0),
  sku:         z.string().max(50).optional().default(''),
  destacado:   z.boolean().optional().default(false),
  activo:      z.boolean().optional().default(true),
});

export const ProductosQuerySchema = z.object({
  busqueda:   z.string().max(100).optional(),
  categoria:  z.string().max(50).optional(),
  orden:      z.enum(['asc', 'desc', 'rating', 'nuevo', 'popular']).optional(),
  desde:      z.coerce.number().min(0).optional(),
  hasta:      z.coerce.number().min(0).optional(),
  enStock:    z.coerce.boolean().optional(),
  destacado:  z.coerce.boolean().optional(),
  rating:     z.coerce.number().min(1).max(5).optional(),
  limit:      z.coerce.number().min(1).max(100).optional(),
  offset:     z.coerce.number().min(0).optional(),
});

// =================================================================
// AUTH
// =================================================================
export const LoginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido').max(50),
  password: z.string().min(1, 'Contraseña requerida').max(1000),
});

export const RegisterSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres').max(50),
  password: z.string().min(6, 'Mínimo 6 caracteres').max(100),
  email:    z.string().email('Email inválido').max(254),
  nombre:   z.string().min(1).max(200).optional(),
});

// =================================================================
// PEDIDOS
// =================================================================
export const PedidoSchema = z.object({
  cliente:   z.string().min(1).max(200),
  email:     z.string().email('Email inválido').max(254),
  direccion: z.string().min(1).max(500),
  items: z.array(z.object({
    id:       z.number().int().positive(),
    cantidad: z.number().int().min(1).max(999),
  })).min(1).max(50, 'Demasiados artículos'),
  cupon:     z.string().max(50).optional(),
});

export const PedidoEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado']),
  notas:  z.string().max(500).optional(),
});

// =================================================================
// COMENTARIOS
// =================================================================
export const ComentarioSchema = z.object({
  autor:     z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  contenido: z.string().min(5, 'El comentario debe tener al menos 5 caracteres').max(1000),
});

// =================================================================
// VALORACIONES
// =================================================================
export const ValoracionSchema = z.object({
  puntuacion: z.number().int().min(1).max(5),
  titulo:     z.string().max(200).optional().default(''),
  comentario: z.string().max(1000).optional().default(''),
});

// =================================================================
// CATEGORÍAS
// =================================================================
export const CategoriaSchema = z.object({
  nombre:      z.string().min(1).max(100),
  descripcion: z.string().max(500).optional().default(''),
  imagen:      z.string().max(500).optional().default(''),
  orden:       z.number().int().min(0).optional().default(0),
  activa:      z.boolean().optional().default(true),
});

// =================================================================
// CUPONES
// =================================================================
export const CuponSchema = z.object({
  codigo:      z.string().min(3).max(50),
  tipo:        z.enum(['porcentaje', 'fijo']),
  valor:       z.number().min(0),
  minCompra:   z.number().min(0).optional().default(0),
  maxUsos:     z.number().int().min(1).optional(),
  activo:      z.boolean().optional().default(true),
  fechaInicio: z.string().optional(),
  fechaFin:    z.string().optional(),
});

export const ValidarCuponSchema = z.object({
  codigo: z.string().min(1).max(50),
  subtotal: z.number().min(0),
});

// =================================================================
// PUSH SUBSCRIPTIONS
// =================================================================
export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth:   z.string(),
  }),
});

// =================================================================
// PERFIL
// =================================================================
export const PerfilSchema = z.object({
  nombre:    z.string().max(200).optional(),
  email:     z.string().email().max(254).optional(),
  direccion: z.string().max(500).optional(),
  telefono:  z.string().max(20).optional(),
  idioma:    z.enum(['es', 'en']).optional(),
});

export const CambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1),
  passwordNueva:  z.string().min(6, 'Mínimo 6 caracteres').max(100),
});

// =================================================================
// Shared types
// =================================================================
export type ProductoBody    = z.infer<typeof ProductoBodySchema>;
export type ProductosQuery  = z.infer<typeof ProductosQuerySchema>;
export type LoginBody       = z.infer<typeof LoginSchema>;
export type RegisterBody    = z.infer<typeof RegisterSchema>;
export type PedidoBody      = z.infer<typeof PedidoSchema>;
export type ComentarioBody  = z.infer<typeof ComentarioSchema>;
export type ValoracionBody  = z.infer<typeof ValoracionSchema>;
export type CategoriaBody   = z.infer<typeof CategoriaSchema>;
export type CuponBody       = z.infer<typeof CuponSchema>;
export type PerfilBody      = z.infer<typeof PerfilSchema>;
