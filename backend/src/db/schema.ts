import { pgTable, serial, text, real, integer, timestamp } from 'drizzle-orm/pg-core';

export const productos = pgTable('productos', {
  id:          serial('id').primaryKey(),
  nombre:      text('nombre').notNull(),
  descripcion: text('descripcion'),
  precio:      real('precio').notNull(),
  imagen:      text('imagen'),
  categoria:   text('categoria'),
  fecha:       timestamp('fecha', { withTimezone: true }).defaultNow(),
});

export const pedidos = pgTable('pedidos', {
  id:        serial('id').primaryKey(),
  cliente:   text('cliente').notNull(),
  email:     text('email').notNull(),
  direccion: text('direccion').notNull(),
  total:     real('total').notNull(),
  fecha:     timestamp('fecha', { withTimezone: true }).defaultNow(),
});

export const pedidoItems = pgTable('pedido_items', {
  id:         serial('id').primaryKey(),
  pedidoId:   integer('pedido_id').notNull().references(() => pedidos.id,   { onDelete: 'cascade'  }),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'restrict' }),
  cantidad:   integer('cantidad').notNull(),
  precio:     real('precio').notNull(),
});

export const usuarios = pgTable('usuarios', {
  id:        serial('id').primaryKey(),
  username:  text('username').notNull().unique(),
  password:  text('password').notNull(),
  email:     text('email'),
  role:      text('role').default('standard'),
  avatar:    text('avatar'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const comentarios = pgTable('comentarios', {
  id:         serial('id').primaryKey(),
  productoId: integer('producto_id').notNull().references(() => productos.id, { onDelete: 'cascade' }),
  autor:      text('autor').notNull(),
  contenido:  text('contenido').notNull(),
  fecha:      timestamp('fecha', { withTimezone: true }).defaultNow(),
});

export type Producto   = typeof productos.$inferSelect;
export type Pedido     = typeof pedidos.$inferSelect;
export type Usuario    = typeof usuarios.$inferSelect;
export type Comentario = typeof comentarios.$inferSelect;
