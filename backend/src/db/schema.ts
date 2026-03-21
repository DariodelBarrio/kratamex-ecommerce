import { pgTable, serial, text, real, integer, timestamp, boolean, unique } from 'drizzle-orm/pg-core';

// =================================================================
// CATEGORÍAS
// =================================================================
export const categorias = pgTable('categorias', {
  id:          serial('id').primaryKey(),
  nombre:      text('nombre').notNull().unique(),
  descripcion: text('descripcion'),
  imagen:      text('imagen'),
  orden:       integer('orden').default(0),
  activa:      boolean('activa').default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// =================================================================
// PRODUCTOS
// =================================================================
export const productos = pgTable('productos', {
  id:          serial('id').primaryKey(),
  nombre:      text('nombre').notNull(),
  descripcion: text('descripcion'),
  precio:      real('precio').notNull(),
  imagen:      text('imagen'),
  categoria:   text('categoria'),
  stock:       integer('stock').default(0).notNull(),
  sku:         text('sku'),
  destacado:   boolean('destacado').default(false),
  activo:      boolean('activo').default(true),
  fecha:       timestamp('fecha', { withTimezone: true }).defaultNow(),
});

// =================================================================
// GALERÍA DE IMÁGENES (múltiples por producto)
// =================================================================
export const productoImagenes = pgTable('producto_imagenes', {
  id:         serial('id').primaryKey(),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  url:        text('url').notNull(),
  orden:      integer('orden').default(0),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// =================================================================
// PEDIDOS
// =================================================================
export const pedidos = pgTable('pedidos', {
  id:          serial('id').primaryKey(),
  usuarioId:   integer('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
  cliente:     text('cliente').notNull(),
  email:       text('email').notNull(),
  direccion:   text('direccion').notNull(),
  total:       real('total').notNull(),
  subtotal:    real('subtotal'),
  impuestos:   real('impuestos'),
  envio:       real('envio'),
  cuponId:     integer('cupon_id').references(() => cupones.id, { onDelete: 'set null' }),
  descuento:   real('descuento').default(0),
  estado:      text('estado').default('pendiente'),
  notas:       text('notas'),
  fecha:       timestamp('fecha', { withTimezone: true }).defaultNow(),
});

export const pedidoItems = pgTable('pedido_items', {
  id:         serial('id').primaryKey(),
  pedidoId:   integer('pedido_id').notNull().references(() => pedidos.id, { onDelete: 'cascade' }),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'restrict' }),
  cantidad:   integer('cantidad').notNull(),
  precio:     real('precio').notNull(),
});

// =================================================================
// USUARIOS
// =================================================================
export const usuarios = pgTable('usuarios', {
  id:        serial('id').primaryKey(),
  username:  text('username').notNull().unique(),
  password:  text('password').notNull(),
  email:     text('email'),
  nombre:    text('nombre'),
  direccion: text('direccion'),
  telefono:  text('telefono'),
  role:      text('role').default('standard'),
  avatar:    text('avatar'),
  idioma:    text('idioma').default('es'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// =================================================================
// COMENTARIOS
// =================================================================
export const comentarios = pgTable('comentarios', {
  id:         serial('id').primaryKey(),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  autor:      text('autor').notNull(),
  contenido:  text('contenido').notNull(),
  fecha:      timestamp('fecha', { withTimezone: true }).defaultNow(),
});

// =================================================================
// VALORACIONES (ratings)
// =================================================================
export const valoraciones = pgTable('valoraciones', {
  id:         serial('id').primaryKey(),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  usuarioId:  integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  puntuacion: integer('puntuacion').notNull(), // 1-5
  titulo:     text('titulo'),
  comentario: text('comentario'),
  fecha:      timestamp('fecha', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique('uq_valoracion_producto_usuario').on(t.productoId, t.usuarioId),
]);

// =================================================================
// FAVORITOS (wishlist persistente)
// =================================================================
export const favoritos = pgTable('favoritos', {
  id:         serial('id').primaryKey(),
  usuarioId:  integer('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique('uq_favorito_usuario_producto').on(t.usuarioId, t.productoId),
]);

// =================================================================
// CUPONES
// =================================================================
export const cupones = pgTable('cupones', {
  id:          serial('id').primaryKey(),
  codigo:      text('codigo').notNull().unique(),
  tipo:        text('tipo').notNull().default('porcentaje'), // 'porcentaje' | 'fijo'
  valor:       real('valor').notNull(),
  minCompra:   real('min_compra').default(0),
  maxUsos:     integer('max_usos'),
  usosActuales: integer('usos_actuales').default(0),
  activo:      boolean('activo').default(true),
  fechaInicio: timestamp('fecha_inicio', { withTimezone: true }),
  fechaFin:    timestamp('fecha_fin', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// =================================================================
// SUSCRIPCIONES PUSH
// =================================================================
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:         serial('id').primaryKey(),
  usuarioId:  integer('usuario_id').references(() => usuarios.id, { onDelete: 'cascade' }),
  endpoint:   text('endpoint').notNull().unique(),
  p256dh:     text('p256dh').notNull(),
  auth:       text('auth').notNull(),
  createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// =================================================================
// SECURITY EVENTS (SOC log)
// =================================================================
export const securityEvents = pgTable('security_events', {
  id:        serial('id').primaryKey(),
  tipo:      text('tipo').notNull(), // login_ok | login_fail | auth_invalid | forbidden | brute_force | register
  ip:        text('ip'),
  username:  text('username'),
  endpoint:  text('endpoint'),
  metodo:    text('metodo'),
  userAgent: text('user_agent'),
  detalles:  text('detalles'),
  fecha:     timestamp('fecha', { withTimezone: true }).defaultNow(),
});

// =================================================================
// Tipos inferidos
// =================================================================
export type Producto      = typeof productos.$inferSelect;
export type Pedido        = typeof pedidos.$inferSelect;
export type PedidoItem    = typeof pedidoItems.$inferSelect;
export type Usuario       = typeof usuarios.$inferSelect;
export type Comentario    = typeof comentarios.$inferSelect;
export type Categoria     = typeof categorias.$inferSelect;
export type Valoracion    = typeof valoraciones.$inferSelect;
export type Favorito      = typeof favoritos.$inferSelect;
export type Cupon         = typeof cupones.$inferSelect;
export type ProductoImagen = typeof productoImagenes.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
