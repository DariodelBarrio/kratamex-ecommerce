import { describe, it, expect } from 'vitest';
import type { Producto, CarritoItem, Pedido, Usuario, Valoracion, Cupon, CostesCalculo } from '../interfaces';

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
});
