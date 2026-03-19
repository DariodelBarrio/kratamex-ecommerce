import { z } from 'zod';

// =================================================================
// PRODUCTOS
// =================================================================
export const ProductoBodySchema = z.object({
  nombre:      z.string().min(1, 'Nombre requerido').max(200),
  descripcion: z.string().max(1000).optional().default(''),
  precio:      z.number({ required_error: 'Precio requerido' }).min(0).max(999999),
  imagen:      z.string().max(500).optional().default(''),
  categoria:   z.string().max(50).optional().default(''),
});

export const ProductosQuerySchema = z.object({
  busqueda:  z.string().max(100).optional(),
  categoria: z.string().max(50).optional(),
  orden:     z.enum(['asc', 'desc']).optional(),
  desde:     z.coerce.number().min(0).optional(),
  hasta:     z.coerce.number().min(0).optional(),
});

// =================================================================
// AUTH
// =================================================================
export const LoginSchema = z.object({
  username: z.string().min(1, 'Usuario requerido'),
  password: z.string().min(1, 'Contraseña requerida'),
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
});

// =================================================================
// COMENTARIOS
// =================================================================
export const ComentarioSchema = z.object({
  autor:     z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  contenido: z.string().min(5, 'El comentario debe tener al menos 5 caracteres').max(1000),
});

// Shared types
export type ProductoBody   = z.infer<typeof ProductoBodySchema>;
export type ProductosQuery = z.infer<typeof ProductosQuerySchema>;
export type LoginBody      = z.infer<typeof LoginSchema>;
export type PedidoBody     = z.infer<typeof PedidoSchema>;
export type ComentarioBody = z.infer<typeof ComentarioSchema>;
