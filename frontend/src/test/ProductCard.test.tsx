import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard, BrandLogoSmall } from '../components/ProductCard';

// ── Framer-motion mock ──────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, onClick, className, style }: React.HTMLAttributes<HTMLDivElement>) =>
      <div onClick={onClick} className={className} style={style} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } : undefined}>{children}</div>, // NOSONAR
    button: ({ children, onClick, className, title, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} className={className} title={title} disabled={disabled}>{children}</button>,
    span:   ({ children, className }: React.HTMLAttributes<HTMLSpanElement>) =>
      <span className={className}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Fixture ─────────────────────────────────────────────────────────
const base = {
  id:              1,
  nombre:         'Portátil Gaming Pro',
  descripcion:    'Alto rendimiento para gaming',
  precio:          999.99,
  imagen:         '',
  categoria:      'Gaming',
  stock:           15,
  activo:          true,
  destacado:       false,
  rating:          0,
  numValoraciones: 0,
};

function renderCard(overrides = {}, extra: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <ProductCard
        producto={{ ...base, ...overrides }}
        onAddToCart={vi.fn()}
        index={0}
        {...extra}
      />
    </MemoryRouter>,
  );
}

// ── Grid view ───────────────────────────────────────────────────────
describe('ProductCard — vista cuadrícula', () => {
  it('renderiza el nombre del producto', () => {
    renderCard();
    expect(screen.getByText('Portátil Gaming Pro')).toBeInTheDocument();
  });

  it('renderiza el precio formateado', () => {
    renderCard();
    expect(screen.getByText('€999.99')).toBeInTheDocument();
  });

  it('muestra "En stock" cuando hay más de 10 unidades', () => {
    renderCard();
    expect(screen.getByText('En stock')).toBeInTheDocument();
  });

  it('muestra "Quedan X" cuando stock ≤ 10 y > 0', () => {
    renderCard({ stock: 5 });
    expect(screen.getByText('Quedan 5')).toBeInTheDocument();
  });

  it('muestra "Sin stock" cuando stock = 0', () => {
    renderCard({ stock: 0 });
    expect(screen.getAllByText('Sin stock').length).toBeGreaterThanOrEqual(1);
  });

  it('llama a onAddToCart al pulsar "Agregar al carrito"', () => {
    const onAddToCart = vi.fn();
    render(
      <MemoryRouter>
        <ProductCard producto={base} onAddToCart={onAddToCart} index={0} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Agregar al carrito'));
    expect(onAddToCart).toHaveBeenCalledWith(base);
  });

  it('NO llama a onAddToCart si stock = 0', () => {
    const onAddToCart = vi.fn();
    render(
      <MemoryRouter>
        <ProductCard producto={{ ...base, stock: 0 }} onAddToCart={onAddToCart} index={0} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Agregar al carrito'));
    expect(onAddToCart).not.toHaveBeenCalled();
  });

  it('llama a onToggleWishlist al pulsar el botón de favoritos', () => {
    const onToggleWishlist = vi.fn();
    render(
      <MemoryRouter>
        <ProductCard
          producto={base}
          onAddToCart={vi.fn()}
          index={0}
          onToggleWishlist={onToggleWishlist}
          isWishlisted={false}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Agregar a favoritos'));
    expect(onToggleWishlist).toHaveBeenCalledWith(base.id);
  });

  it('muestra el título "Quitar de favoritos" cuando isWishlisted = true', () => {
    renderCard({}, { onToggleWishlist: vi.fn(), isWishlisted: true });
    expect(screen.getByTitle('Quitar de favoritos')).toBeInTheDocument();
  });

  it('renderiza la descripción del producto', () => {
    renderCard();
    expect(screen.getByText('Alto rendimiento para gaming')).toBeInTheDocument();
  });

  it('renderiza la categoría del producto', () => {
    renderCard();
    expect(screen.getByText('Gaming')).toBeInTheDocument();
  });
});

// ── List view ────────────────────────────────────────────────────────
describe('ProductCard — vista lista (vistaLista=true)', () => {
  it('renderiza en modo lista', () => {
    renderCard({}, { vistaLista: true });
    expect(screen.getByText('Portátil Gaming Pro')).toBeInTheDocument();
    expect(screen.getByText('$999.99')).toBeInTheDocument();
  });

  it('llama a onAddToCart en vista lista', () => {
    const onAddToCart = vi.fn();
    render(
      <MemoryRouter>
        <ProductCard producto={base} onAddToCart={onAddToCart} index={0} vistaLista />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Agregar al carrito'));
    expect(onAddToCart).toHaveBeenCalledWith(base);
  });

  it('llama a onToggleWishlist en vista lista', () => {
    const onToggleWishlist = vi.fn();
    render(
      <MemoryRouter>
        <ProductCard
          producto={base}
          onAddToCart={vi.fn()}
          index={0}
          vistaLista
          onToggleWishlist={onToggleWishlist}
          isWishlisted={false}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Agregar a favoritos'));
    expect(onToggleWishlist).toHaveBeenCalledWith(base.id);
  });
});

// ── BrandLogoSmall ───────────────────────────────────────────────────
describe('BrandLogoSmall', () => {
  it('renderiza la imagen cuando se pasa imagen', () => {
    const { container } = render(
      <BrandLogoSmall imagen="http://example.com/img.png" nombre="Test" />,
    );
    expect(container.querySelector('img')).toBeInTheDocument();
  });

  it('renderiza el placeholder cuando no hay imagen', () => {
    const { container } = render(<BrandLogoSmall nombre="Test" />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    // Monitor icon from lucide renders as SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
