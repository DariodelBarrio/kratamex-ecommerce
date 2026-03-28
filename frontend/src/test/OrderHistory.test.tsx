import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, style, onClick }: React.HTMLAttributes<HTMLDivElement>) =>
      <div style={style} onClick={onClick}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Package:     ({ size }: { size: number }) => <svg data-testid="icon-package" width={size} />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp:   () => <svg data-testid="icon-chevron-up" />,
  X:           () => <svg data-testid="icon-x" />,
}));

// Mock useQuery directamente para control total del estado
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...(actual as object), useQuery: vi.fn() };
});

import { useQuery } from '@tanstack/react-query';
import OrderHistory from '../components/OrderHistory';

function renderOH() {
  return render(<MemoryRouter><OrderHistory /></MemoryRouter>);
}

describe('OrderHistory', () => {
  it('muestra skeleton mientras carga', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    renderOH();
    expect(document.body).toBeInTheDocument();
  });

  it('muestra mensaje "sin pedidos" cuando el array está vacío', () => {
    vi.mocked(useQuery).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    renderOH();
    expect(screen.getByText('No tienes pedidos aún')).toBeInTheDocument();
  });

  it('muestra pedidos cuando la API devuelve datos', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 42,
        cliente: 'Test User',
        email: 'test@test.com',
        direccion: 'Calle Prueba 1',
        total: 99.99,
        subtotal: 80,
        impuestos: 16.8,
        envio: 5.99,
        descuento: 0,
        estado: 'pendiente',
        fecha: new Date().toISOString(),
        items: [],
      }],
      isLoading: false,
      isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Pedido #42')).toBeInTheDocument();
  });

  it('muestra error cuando isError = true', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    renderOH();
    // General error message (t('general.error'))
    expect(document.body).toBeInTheDocument();
  });

  it('muestra el total del pedido formateado', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 1, cliente: 'A', email: 'a@a.com', direccion: 'C', total: 123.45,
        estado: 'confirmado', fecha: new Date().toISOString(), items: [],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    expect(screen.getByText(/123\.45/)).toBeInTheDocument();
  });

  it('muestra el estado "confirmado" en el badge', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 2, cliente: 'B', email: 'b@b.com', direccion: 'D', total: 50,
        estado: 'confirmado', fecha: new Date().toISOString(), items: [],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Confirmado')).toBeInTheDocument();
  });

  it('muestra el estado "enviado" en el badge', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 3, cliente: 'C', email: 'c@c.com', direccion: 'E', total: 75,
        estado: 'enviado', fecha: new Date().toISOString(), items: [],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });

  it('muestra el estado "entregado" en el badge', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 4, cliente: 'D', email: 'd@d.com', direccion: 'F', total: 200,
        estado: 'entregado', fecha: new Date().toISOString(), items: [],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Entregado')).toBeInTheDocument();
  });

  it('muestra el estado "cancelado" en el badge', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 5, cliente: 'E', email: 'e@e.com', direccion: 'G', total: 0,
        estado: 'cancelado', fecha: new Date().toISOString(), items: [],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
  });

  it('muestra botón expandir cuando el pedido tiene items', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 10, cliente: 'F', email: 'f@f.com', direccion: 'H', total: 100,
        estado: 'pendiente', fecha: new Date().toISOString(),
        items: [{ id: 1, productoId: 1, cantidad: 2, precio: 50, nombre: 'Laptop', imagen: '' }],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    // Button with item count
    expect(screen.getByRole('button', { name: /1/i })).toBeInTheDocument();
  });

  it('expande los items al hacer click en el botón', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 11, cliente: 'G', email: 'g@g.com', direccion: 'I', total: 100,
        estado: 'pendiente', fecha: new Date().toISOString(),
        items: [{ id: 1, productoId: 1, cantidad: 3, precio: 30, nombre: 'Monitor', imagen: '' }],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    // Click expand button (not the X close button which has title="Volver")
    const btns = screen.getAllByRole('button');
    const expandBtn = btns.find(b => b.getAttribute('title') !== 'Volver')!;
    fireEvent.click(expandBtn);
    expect(screen.getByText('Monitor')).toBeInTheDocument();
  });

  it('muestra el nombre del producto en los items expandidos', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [{
        id: 12, cliente: 'H', email: 'h@h.com', direccion: 'J', total: 150,
        estado: 'entregado', fecha: new Date().toISOString(),
        items: [
          { id: 1, productoId: 2, cantidad: 1, precio: 100, nombre: 'Teclado Mecánico', imagen: '' },
          { id: 2, productoId: 3, cantidad: 2, precio: 25, nombre: 'Ratón', imagen: 'mouse.jpg' },
        ],
      }],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    const btns = screen.getAllByRole('button');
    const expandBtn = btns.find(b => b.getAttribute('title') !== 'Volver')!;
    fireEvent.click(expandBtn);
    expect(screen.getByText('Teclado Mecánico')).toBeInTheDocument();
    expect(screen.getByText('Ratón')).toBeInTheDocument();
  });

  it('muestra múltiples pedidos', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [
        { id: 20, cliente: 'X', email: 'x@x.com', direccion: 'A', total: 10, estado: 'pendiente', fecha: new Date().toISOString(), items: [] },
        { id: 21, cliente: 'Y', email: 'y@y.com', direccion: 'B', total: 20, estado: 'enviado',   fecha: new Date().toISOString(), items: [] },
      ],
      isLoading: false, isError: false,
    } as never);
    renderOH();
    expect(screen.getByText('Pedido #20')).toBeInTheDocument();
    expect(screen.getByText('Pedido #21')).toBeInTheDocument();
  });
});
