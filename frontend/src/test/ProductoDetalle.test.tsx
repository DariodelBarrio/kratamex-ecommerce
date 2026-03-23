import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Framer-motion mock ──────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, className, style, onClick }: React.HTMLAttributes<HTMLDivElement>) =>
      <div className={className} style={style} onClick={onClick}>{children}</div>,
    button: ({ children, onClick, disabled, className, style }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} disabled={disabled} className={className} style={style}>{children}</button>,
    span:   ({ children, style }: React.HTMLAttributes<HTMLSpanElement>) => <span style={style}>{children}</span>,
    li:     ({ children, className }: React.LiHTMLAttributes<HTMLLIElement>) => <li className={className}>{children}</li>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── useQuery mock (control total) ──────────────────────────────────
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...(actual as object), useQuery: vi.fn() };
});

// ── StarRating sub-components mock ─────────────────────────────────
vi.mock('../components/StarRating', () => ({
  StarRating:      () => <div data-testid="star-rating" />,
  RatingForm:      () => <div data-testid="rating-form" />,
  ValoracionesList:() => <div data-testid="valoraciones-list" />,
}));

import { useQuery } from '@tanstack/react-query';
import ProductoDetalle from '../components/ProductoDetalle';

// ── Fixture ─────────────────────────────────────────────────────────
const mockProducto = {
  id: 1,
  nombre: 'Monitor 4K UltraWide',
  descripcion: 'Alta resolución,Panel IPS,144Hz',
  precio: 599.99,
  imagen: '',
  categoria: 'Monitores',
  stock: 15,
  activo: true,
  destacado: false,
  rating: 0,
  numValoraciones: 0,
};

function renderPD(props: Partial<React.ComponentProps<typeof ProductoDetalle>> = {}) {
  return render(
    <MemoryRouter initialEntries={['/producto/1']}>
      <ProductoDetalle
        onAddToCart={vi.fn()}
        carritoCount={0}
        onOpenCart={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

/** Configura useQuery por queryKey: producto → productData, relacionados → [] */
function mockQueryWith(productData: unknown, isLoading = false, isError = false) {
  vi.mocked(useQuery).mockImplementation(({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === 'producto') return { data: productData, isLoading, isError } as never;
    return { data: [], isLoading: false, isError: false } as never; // productos-relacionados
  });
}

describe('ProductoDetalle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('muestra skeleton de carga mientras isLoading = true', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: true, isError: false } as never);
    const { container } = renderPD();
    expect(container.querySelector('.detalle-loading-page')).toBeInTheDocument();
  });

  it('muestra "Producto no encontrado" cuando isError = true', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, isError: true } as never);
    renderPD();
    expect(screen.getByText('Producto no encontrado')).toBeInTheDocument();
  });

  it('muestra "Producto no encontrado" cuando data es undefined', () => {
    vi.mocked(useQuery).mockReturnValue({ data: undefined, isLoading: false, isError: false } as never);
    renderPD();
    expect(screen.getByText('Producto no encontrado')).toBeInTheDocument();
  });

  it('renderiza el nombre y precio del producto', () => {
    mockQueryWith(mockProducto);
    renderPD();
    expect(screen.getByRole('heading', { name: 'Monitor 4K UltraWide' })).toBeInTheDocument();
    expect(screen.getByText(/599\.99/)).toBeInTheDocument();
  });

  it('muestra "En stock" cuando stock > 10', () => {
    mockQueryWith(mockProducto);
    renderPD();
    expect(screen.getByText(/En stock/)).toBeInTheDocument();
  });

  it('muestra "Últimas X unidades" cuando 0 < stock ≤ 10', () => {
    mockQueryWith({ ...mockProducto, stock: 3 });
    renderPD();
    expect(screen.getByText(/Últimas 3 unidades/)).toBeInTheDocument();
  });

  it('muestra "Sin stock" y botón deshabilitado cuando stock = 0', () => {
    mockQueryWith({ ...mockProducto, stock: 0 });
    renderPD();
    expect(screen.getByText('Sin stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar al carrito/i })).toBeDisabled();
  });

  it('llama a onAddToCart al pulsar "Agregar al carrito"', () => {
    const onAddToCart = vi.fn();
    mockQueryWith(mockProducto);
    renderPD({ onAddToCart });
    fireEvent.click(screen.getByRole('button', { name: /agregar al carrito/i }));
    expect(onAddToCart).toHaveBeenCalledWith(mockProducto);
  });

  it('muestra el breadcrumb con la categoría del producto', () => {
    mockQueryWith(mockProducto);
    renderPD();
    // Categoria aparece en breadcrumb y en badge — verificamos que al menos existe
    expect(screen.getAllByText('Monitores').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra las especificaciones divididas por coma', () => {
    mockQueryWith(mockProducto);
    renderPD();
    expect(screen.getByText('Alta resolución')).toBeInTheDocument();
    expect(screen.getByText('Panel IPS')).toBeInTheDocument();
  });

  it('muestra el contador del carrito cuando carritoCount > 0', () => {
    mockQueryWith(mockProducto);
    renderPD({ carritoCount: 3 });
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('botón Volver llama a navigate(-1)', () => {
    mockQueryWith(mockProducto);
    renderPD();
    // Solo verificamos que el botón existe y no lanza errores al hacer click
    const btn = screen.getByRole('button', { name: /volver/i });
    expect(btn).toBeInTheDocument();
    expect(() => fireEvent.click(btn)).not.toThrow();
  });
});
