import { describe, it, expect } from 'vitest';
import {
  ProductoBodySchema,
  ProductosQuerySchema,
  LoginSchema,
  RegisterSchema,
  PedidoSchema,
  PedidoEstadoSchema,
  ComentarioSchema,
  ValoracionSchema,
  CategoriaSchema,
  CuponSchema,
  ValidarCuponSchema,
  PushSubscriptionSchema,
  PerfilSchema,
  CambiarPasswordSchema,
} from '../schemas';

// =================================================================
// ProductoBodySchema
// =================================================================
describe('ProductoBodySchema', () => {
  const valid = { nombre: 'Laptop', precio: 999.99 };

  it('acepta datos válidos mínimos', () => {
    expect(() => ProductoBodySchema.parse(valid)).not.toThrow();
  });

  it('acepta todos los campos opcionales', () => {
    expect(() => ProductoBodySchema.parse({
      ...valid,
      descripcion: 'Desc', imagen: 'img.jpg', categoria: 'Tech',
      stock: 10, sku: 'LAP001', destacado: true, activo: false,
    })).not.toThrow();
  });

  it('falla si nombre está vacío', () => {
    expect(() => ProductoBodySchema.parse({ ...valid, nombre: '' })).toThrow();
  });

  it('falla si precio es negativo', () => {
    expect(() => ProductoBodySchema.parse({ ...valid, precio: -1 })).toThrow();
  });

  it('falla si nombre supera 200 caracteres', () => {
    expect(() => ProductoBodySchema.parse({ ...valid, nombre: 'a'.repeat(201) })).toThrow();
  });

  it('aplica defaults: descripcion vacía, stock 0, activo true', () => {
    const result = ProductoBodySchema.parse(valid);
    expect(result.descripcion).toBe('');
    expect(result.stock).toBe(0);
    expect(result.activo).toBe(true);
    expect(result.destacado).toBe(false);
  });
});

// =================================================================
// ProductosQuerySchema
// =================================================================
describe('ProductosQuerySchema', () => {
  it('acepta objeto vacío', () => {
    expect(() => ProductosQuerySchema.parse({})).not.toThrow();
  });

  it('acepta todos los filtros válidos', () => {
    expect(() => ProductosQuerySchema.parse({
      busqueda: 'laptop', categoria: 'Tech', orden: 'asc',
      desde: '0', hasta: '1000', enStock: 'true',
      destacado: 'false', rating: '4', limit: '10', offset: '0',
    })).not.toThrow();
  });

  it('falla si orden no es un valor permitido', () => {
    expect(() => ProductosQuerySchema.parse({ orden: 'random' })).toThrow();
  });

  it('falla si rating está fuera de rango (0)', () => {
    expect(() => ProductosQuerySchema.parse({ rating: '0' })).toThrow();
  });

  it('falla si rating está fuera de rango (6)', () => {
    expect(() => ProductosQuerySchema.parse({ rating: '6' })).toThrow();
  });

  it('acepta orden "rating"', () => {
    expect(() => ProductosQuerySchema.parse({ orden: 'rating' })).not.toThrow();
  });

  it('acepta orden "nuevo"', () => {
    expect(() => ProductosQuerySchema.parse({ orden: 'nuevo' })).not.toThrow();
  });

  it('acepta orden "popular"', () => {
    expect(() => ProductosQuerySchema.parse({ orden: 'popular' })).not.toThrow();
  });
});

// =================================================================
// LoginSchema
// =================================================================
describe('LoginSchema', () => {
  const valid = { username: 'admin', password: 'secret123' };

  it('acepta credenciales válidas', () => {
    expect(() => LoginSchema.parse(valid)).not.toThrow();
  });

  it('falla si username está vacío', () => {
    expect(() => LoginSchema.parse({ ...valid, username: '' })).toThrow();
  });

  it('falla si password está vacío', () => {
    expect(() => LoginSchema.parse({ ...valid, password: '' })).toThrow();
  });
});

// =================================================================
// RegisterSchema
// =================================================================
describe('RegisterSchema', () => {
  const valid = { username: 'user01', password: 'Pass123', email: 'user@test.com' };

  it('acepta registro válido', () => {
    expect(() => RegisterSchema.parse(valid)).not.toThrow();
  });

  it('falla si username tiene menos de 3 caracteres', () => {
    expect(() => RegisterSchema.parse({ ...valid, username: 'ab' })).toThrow();
  });

  it('falla si password tiene menos de 6 caracteres', () => {
    expect(() => RegisterSchema.parse({ ...valid, password: '123' })).toThrow();
  });

  it('falla si email es inválido', () => {
    expect(() => RegisterSchema.parse({ ...valid, email: 'no-es-email' })).toThrow();
  });

  it('acepta nombre opcional', () => {
    expect(() => RegisterSchema.parse({ ...valid, nombre: 'Juan' })).not.toThrow();
  });
});

// =================================================================
// PedidoSchema
// =================================================================
describe('PedidoSchema', () => {
  const valid = {
    cliente: 'Juan Pérez',
    email: 'juan@test.com',
    direccion: 'Calle Mayor 1',
    items: [{ id: 1, cantidad: 2 }],
  };

  it('acepta pedido válido', () => {
    expect(() => PedidoSchema.parse(valid)).not.toThrow();
  });

  it('acepta pedido con cupón', () => {
    expect(() => PedidoSchema.parse({ ...valid, cupon: 'DESC10' })).not.toThrow();
  });

  it('falla si items está vacío', () => {
    expect(() => PedidoSchema.parse({ ...valid, items: [] })).toThrow();
  });

  it('falla si email es inválido', () => {
    expect(() => PedidoSchema.parse({ ...valid, email: 'malo' })).toThrow();
  });

  it('falla si cantidad es 0', () => {
    expect(() => PedidoSchema.parse({ ...valid, items: [{ id: 1, cantidad: 0 }] })).toThrow();
  });

  it('falla si id no es positivo', () => {
    expect(() => PedidoSchema.parse({ ...valid, items: [{ id: 0, cantidad: 1 }] })).toThrow();
  });
});

// =================================================================
// PedidoEstadoSchema
// =================================================================
describe('PedidoEstadoSchema', () => {
  it('acepta todos los estados válidos', () => {
    for (const estado of ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado']) {
      expect(() => PedidoEstadoSchema.parse({ estado })).not.toThrow();
    }
  });

  it('falla si estado es desconocido', () => {
    expect(() => PedidoEstadoSchema.parse({ estado: 'devuelto' })).toThrow();
  });

  it('acepta notas opcionales', () => {
    expect(() => PedidoEstadoSchema.parse({ estado: 'enviado', notas: 'Envío urgente' })).not.toThrow();
  });
});

// =================================================================
// ComentarioSchema
// =================================================================
describe('ComentarioSchema', () => {
  const valid = { autor: 'Ana García', contenido: 'Muy buen producto' };

  it('acepta comentario válido', () => {
    expect(() => ComentarioSchema.parse(valid)).not.toThrow();
  });

  it('falla si autor tiene menos de 2 caracteres', () => {
    expect(() => ComentarioSchema.parse({ ...valid, autor: 'A' })).toThrow();
  });

  it('falla si contenido tiene menos de 5 caracteres', () => {
    expect(() => ComentarioSchema.parse({ ...valid, contenido: 'Ok' })).toThrow();
  });
});

// =================================================================
// ValoracionSchema
// =================================================================
describe('ValoracionSchema', () => {
  it('acepta valoración mínima', () => {
    expect(() => ValoracionSchema.parse({ puntuacion: 1 })).not.toThrow();
  });

  it('acepta valoración máxima con campos opcionales', () => {
    expect(() => ValoracionSchema.parse({
      puntuacion: 5, titulo: 'Excelente', comentario: 'Todo perfecto',
    })).not.toThrow();
  });

  it('falla si puntuacion es 0', () => {
    expect(() => ValoracionSchema.parse({ puntuacion: 0 })).toThrow();
  });

  it('falla si puntuacion es 6', () => {
    expect(() => ValoracionSchema.parse({ puntuacion: 6 })).toThrow();
  });

  it('aplica default vacío para titulo y comentario', () => {
    const result = ValoracionSchema.parse({ puntuacion: 3 });
    expect(result.titulo).toBe('');
    expect(result.comentario).toBe('');
  });
});

// =================================================================
// CategoriaSchema
// =================================================================
describe('CategoriaSchema', () => {
  it('acepta categoría válida', () => {
    expect(() => CategoriaSchema.parse({ nombre: 'Laptops' })).not.toThrow();
  });

  it('falla si nombre está vacío', () => {
    expect(() => CategoriaSchema.parse({ nombre: '' })).toThrow();
  });

  it('aplica defaults correctos', () => {
    const result = CategoriaSchema.parse({ nombre: 'Tech' });
    expect(result.descripcion).toBe('');
    expect(result.orden).toBe(0);
    expect(result.activa).toBe(true);
  });
});

// =================================================================
// CuponSchema
// =================================================================
describe('CuponSchema', () => {
  const valid = { codigo: 'DESC10', tipo: 'porcentaje' as const, valor: 10 };

  it('acepta cupón porcentaje', () => {
    expect(() => CuponSchema.parse(valid)).not.toThrow();
  });

  it('acepta cupón fijo', () => {
    expect(() => CuponSchema.parse({ ...valid, tipo: 'fijo', valor: 5 })).not.toThrow();
  });

  it('falla si codigo tiene menos de 3 caracteres', () => {
    expect(() => CuponSchema.parse({ ...valid, codigo: 'AB' })).toThrow();
  });

  it('falla si tipo no es válido', () => {
    expect(() => CuponSchema.parse({ ...valid, tipo: 'gratis' })).toThrow();
  });

  it('falla si valor es negativo', () => {
    expect(() => CuponSchema.parse({ ...valid, valor: -1 })).toThrow();
  });

  it('acepta fechas opcionales', () => {
    expect(() => CuponSchema.parse({ ...valid, fechaInicio: '2025-01-01', fechaFin: '2025-12-31' })).not.toThrow();
  });
});

// =================================================================
// ValidarCuponSchema
// =================================================================
describe('ValidarCuponSchema', () => {
  it('acepta datos válidos', () => {
    expect(() => ValidarCuponSchema.parse({ codigo: 'DESC10', subtotal: 100 })).not.toThrow();
  });

  it('falla si codigo está vacío', () => {
    expect(() => ValidarCuponSchema.parse({ codigo: '', subtotal: 100 })).toThrow();
  });

  it('falla si subtotal es negativo', () => {
    expect(() => ValidarCuponSchema.parse({ codigo: 'DESC', subtotal: -1 })).toThrow();
  });
});

// =================================================================
// PushSubscriptionSchema
// =================================================================
describe('PushSubscriptionSchema', () => {
  const valid = {
    endpoint: 'https://push.example.com/sub/abc123',
    keys: { p256dh: 'keyABC', auth: 'authXYZ' },
  };

  it('acepta suscripción válida', () => {
    expect(() => PushSubscriptionSchema.parse(valid)).not.toThrow();
  });

  it('falla si endpoint no es una URL', () => {
    expect(() => PushSubscriptionSchema.parse({ ...valid, endpoint: 'no-es-url' })).toThrow();
  });

  it('falla si faltan las keys', () => {
    expect(() => PushSubscriptionSchema.parse({ endpoint: valid.endpoint })).toThrow();
  });
});

// =================================================================
// PerfilSchema
// =================================================================
describe('PerfilSchema', () => {
  it('acepta objeto vacío (todos opcionales)', () => {
    expect(() => PerfilSchema.parse({})).not.toThrow();
  });

  it('acepta todos los campos', () => {
    expect(() => PerfilSchema.parse({
      nombre: 'Juan', email: 'juan@test.com',
      direccion: 'Calle 1', telefono: '600000000', idioma: 'es',
    })).not.toThrow();
  });

  it('falla si email es inválido', () => {
    expect(() => PerfilSchema.parse({ email: 'malformado' })).toThrow();
  });

  it('falla si idioma no es "es" ni "en"', () => {
    expect(() => PerfilSchema.parse({ idioma: 'fr' })).toThrow();
  });

  it('acepta idioma "en"', () => {
    expect(() => PerfilSchema.parse({ idioma: 'en' })).not.toThrow();
  });
});

// =================================================================
// CambiarPasswordSchema
// =================================================================
describe('CambiarPasswordSchema', () => {
  const valid = { passwordActual: 'oldPass', passwordNueva: 'newPass123' };

  it('acepta cambio de contraseña válido', () => {
    expect(() => CambiarPasswordSchema.parse(valid)).not.toThrow();
  });

  it('falla si passwordActual está vacía', () => {
    expect(() => CambiarPasswordSchema.parse({ ...valid, passwordActual: '' })).toThrow();
  });

  it('falla si passwordNueva tiene menos de 6 caracteres', () => {
    expect(() => CambiarPasswordSchema.parse({ ...valid, passwordNueva: '123' })).toThrow();
  });
});
