CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer,
	"admin_username" text NOT NULL,
	"accion" text NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" integer,
	"detalles" text,
	"fecha" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blocked_ips" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"motivo" text,
	"bloqueado_hasta" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "blocked_ips_ip_unique" UNIQUE("ip")
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"imagen" text,
	"orden" integer DEFAULT 0,
	"activa" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "categorias_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "comentarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"autor" text NOT NULL,
	"contenido" text NOT NULL,
	"fecha" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cupones" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"tipo" text DEFAULT 'porcentaje' NOT NULL,
	"valor" real NOT NULL,
	"min_compra" real DEFAULT 0,
	"max_usos" integer,
	"usos_actuales" integer DEFAULT 0,
	"activo" boolean DEFAULT true,
	"fecha_inicio" timestamp with time zone,
	"fecha_fin" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cupones_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "favoritos" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_favorito_usuario_producto" UNIQUE("usuario_id","producto_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "pedido_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"precio" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"cliente" text NOT NULL,
	"email" text NOT NULL,
	"direccion" text NOT NULL,
	"total" real NOT NULL,
	"subtotal" real,
	"impuestos" real,
	"envio" real,
	"cupon_id" integer,
	"descuento" real DEFAULT 0,
	"estado" text DEFAULT 'pendiente',
	"notas" text,
	"fecha" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "producto_imagenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"url" text NOT NULL,
	"orden" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"precio" real NOT NULL,
	"imagen" text,
	"categoria" text,
	"stock" integer DEFAULT 0 NOT NULL,
	"sku" text,
	"destacado" boolean DEFAULT false,
	"activo" boolean DEFAULT true,
	"fecha" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"ip" text,
	"username" text,
	"endpoint" text,
	"metodo" text,
	"user_agent" text,
	"detalles" text,
	"fecha" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"nombre" text,
	"direccion" text,
	"telefono" text,
	"role" text DEFAULT 'standard',
	"avatar" text,
	"idioma" text DEFAULT 'es',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "usuarios_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "valoraciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"puntuacion" integer NOT NULL,
	"titulo" text,
	"comentario" text,
	"fecha" timestamp with time zone DEFAULT now(),
	CONSTRAINT "uq_valoracion_producto_usuario" UNIQUE("producto_id","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_admin_id_usuarios_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favoritos" ADD CONSTRAINT "favoritos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cupon_id_cupones_id_fk" FOREIGN KEY ("cupon_id") REFERENCES "public"."cupones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_imagenes" ADD CONSTRAINT "producto_imagenes_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;