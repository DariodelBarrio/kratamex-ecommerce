import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';

// Mock framer-motion — avoids animation/browser-API issues in jsdom
vi.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, onClick, className, style }: React.HTMLAttributes<HTMLDivElement>) =>
      <div onClick={onClick} className={className} style={style}>{children}</div>,
    button: ({ children, onClick, className, title, disabled }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      <button onClick={onClick} className={className} title={title} disabled={disabled}>{children}</button>,
    span:   ({ children, className }: React.HTMLAttributes<HTMLSpanElement>) =>
      <span className={className}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockProducto = {
  id:             1,
  nombre:         'Portátil Gaming Pro',
  descripcion:    'Alto rendimiento para gaming',
  precio:         999.99,
  imagen:         '',
  categoria:      'Gaming',
  stock:          15,
  activo:         true,
  destacado:      false,
  rating:         0,
  numValoraciones: 0,
};

function renderCard() {
  render(
    <MemoryRouter>
      <ProductCard producto={mockProducto} onAddToCart={vi.fn()} index={0} />
    </MemoryRouter>,
  );
}

describe('ProductCard', () => {
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
});
