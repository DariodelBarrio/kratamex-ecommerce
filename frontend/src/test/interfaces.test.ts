import { describe, it, expect } from 'vitest';
import type {
  Producto, CarritoItem, Pedido, CostesCalculo,
  Valoracion, PedidoItem, Categoria, Cupon, AuthState, Usuario,
} from '../interfaces';

describe('Interfaces', () => {
  it('Producto has all required fields', () => {
    const p: Producto = {
      id: 1,
      nombre: 'Test',
      descripcion: 'Desc',
      precio: 99.99,
      imagen: '/img.jpg',
      categoria: 'Test',
      stock: 10,
    };
    expect(p.id).toBe(1);
    expect(p.stock).toBe(10);
  });

  it('CarritoItem extends Producto with cantidad', () => {
    const item: CarritoItem = {
      id: 1,
      nombre: 'Test',
      descripcion: 'Desc',
      precio: 50,
      imagen: '',
      categoria: '',
      stock: 5,
      cantidad: 3,
    };
    expect(item.cantidad).toBe(3);
    expect(item.precio * item.cantidad).toBe(150);
  });

  it('Pedido has estado and financial fields', () => {
    const pedido: Pedido = {
      id: 1,
      cliente: 'Test',
      email: 'test@test.com',
      direccion: 'Calle 1',
      total: 121,
      subtotal: 100,
      impuestos: 21,
      envio: 0,
      estado: 'pendiente',
      fecha: '2024-01-01',
    };
    expect(pedido.estado).toBe('pendiente');
    expect(pedido.total).toBe(121);
  });

  it('CostesCalculo computes correctly', () => {
    const costes: CostesCalculo = {
      subtotal: 100,
      envio: 0,
      impuestos: 21,
      total: 121,
      envioGratisMinimo: 100,
      ivaRate: 0.21,
    };
    expect(costes.subtotal * costes.ivaRate).toBe(costes.impuestos);
  });

  it('Valoracion has puntuacion and username', () => {
    const v: Valoracion = {
      id: 1,
      puntuacion: 5,
      titulo: 'Excelente',
      comentario: 'Muy recomendable',
      fecha: '2024-01-01',
      username: 'usuario1',
      avatar: null,
    };
    expect(v.puntuacion).toBe(5);
    expect(v.avatar).toBeNull();
  });

  it('Valoracion acepta avatar como string', () => {
    const v: Valoracion = {
      id: 2, puntuacion: 3, titulo: '', comentario: '',
      fecha: '2024-01-01', username: 'user2', avatar: 'http://example.com/avatar.jpg',
    };
    expect(typeof v.avatar).toBe('string');
  });

  it('PedidoItem tiene todos los campos requeridos', () => {
    const item: PedidoItem = {
      id: 1, productoId: 5, cantidad: 2, precio: 49.99,
      nombre: 'Laptop', imagen: '',
    };
    expect(item.precio * item.cantidad).toBeCloseTo(99.98, 2);
  });

  it('Categoria tiene id, nombre, orden y activa', () => {
    const cat: Categoria = {
      id: 1, nombre: 'Gaming', orden: 1, activa: true,
    };
    expect(cat.activa).toBe(true);
    expect(cat.orden).toBe(1);
  });

  it('Cupon porcentaje tiene los campos correctos', () => {
    const cupon: Cupon = {
      id: 1, codigo: 'SAVE10', tipo: 'porcentaje',
      valor: 10, activo: true,
    };
    expect(cupon.tipo).toBe('porcentaje');
    expect(cupon.activo).toBe(true);
  });

  it('Cupon fijo acepta minCompra y maxUsos', () => {
    const cupon: Cupon = {
      id: 2, codigo: 'FLAT5', tipo: 'fijo',
      valor: 5, activo: true, minCompra: 30, maxUsos: 100, usosActuales: 42,
    };
    expect(cupon.valor).toBe(5);
    expect(cupon.usosActuales).toBe(42);
  });

  it('Usuario tiene campos opcionales', () => {
    const usuario: Usuario = {
      id: 1, username: 'testuser', role: 'standard',
      email: 'test@test.com', nombre: 'Test', avatar: null,
      direccion: 'Calle 1', telefono: '600000000', idioma: 'es',
    };
    expect(usuario.idioma).toBe('es');
    expect(usuario.avatar).toBeNull();
  });

  it('AuthState puede ser no autenticado', () => {
    const auth: AuthState = {
      token: null, user: null, isAuthenticated: false,
    };
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('AuthState puede ser autenticado', () => {
    const auth: AuthState = {
      token: 'abc123',
      user: { id: 1, username: 'admin', role: 'admin' },
      isAuthenticated: true,
    };
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.role).toBe('admin');
  });

  it('Producto con campos opcionales', () => {
    const p: Producto = {
      id: 99, nombre: 'GPU', descripcion: 'High-end', precio: 800,
      imagen: '', categoria: 'Tech', stock: 5,
      sku: 'GPU001', destacado: true, activo: true,
      rating: 4.8, numValoraciones: 120, imagenes: ['a.jpg', 'b.jpg'],
    };
    expect(p.rating).toBe(4.8);
    expect(p.imagenes?.length).toBe(2);
  });
});
