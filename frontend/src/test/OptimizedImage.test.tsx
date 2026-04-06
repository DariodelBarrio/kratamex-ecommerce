import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { OptimizedImage } from '../components/OptimizedImage';

describe('OptimizedImage', () => {
  it('should render with placeholder initially', () => {
    render(
      <OptimizedImage 
        src="test.jpg" 
        alt="Test" 
        data-testid="img"
      />
    );
    
    const img = screen.getByTestId('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', 'Test');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('should handle error state', async () => {
    render(
      <OptimizedImage 
        src="invalid.jpg" 
        alt="Test"
        data-testid="img" 
      />
    );
    
    const img = screen.getByTestId('img');
    Object.getOwnPropertyDescriptor(globalThis.Image.prototype, 'onerror')?.value?.call(img);
  });

  it('should have correct src after load', async () => {
    render(
      <OptimizedImage
        src="test.jpg"
        alt="Test"
        data-testid="img"
      />
    );

    const img = screen.getByTestId('img');
    await act(async () => {
      fireEvent.load(img);
    });

    await waitFor(() => {
      expect(img).toHaveAttribute('src', 'test.jpg');
    });
  });

  it('tiene atributo decoding="async"', () => {
    render(<OptimizedImage src="test.jpg" alt="Test" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveAttribute('decoding', 'async');
  });

  it('tiene atributo loading="lazy"', () => {
    render(<OptimizedImage src="test.jpg" alt="Test" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveAttribute('loading', 'lazy');
  });

  it('usa src del placeholder personalizado cuando hay error', async () => {
    render(
      <OptimizedImage
        src="bad.jpg"
        alt="Test"
        placeholder="fallback.jpg"
        data-testid="img"
      />
    );
    const img = screen.getByTestId('img');
    fireEvent.error(img);
    await waitFor(() => {
      expect(img).toHaveAttribute('src', 'fallback.jpg');
    });
  });

  it('opacidad es 0.5 inicialmente (imagen no cargada)', () => {
    render(<OptimizedImage src="test.jpg" alt="Test" data-testid="img" />);
    const img = screen.getByTestId('img');
    expect(img).toHaveStyle({ opacity: 0.5 });
  });

  it('opacidad es 1 tras disparar onLoad', async () => {
    render(<OptimizedImage src="test.jpg" alt="Test" data-testid="img" />);
    const img = screen.getByTestId('img');
    fireEvent.load(img);
    await waitFor(() => {
      expect(img).toHaveStyle({ opacity: 1 });
    });
  });

  it('acepta className y la aplica', () => {
    render(<OptimizedImage src="test.jpg" alt="Test" className="mi-clase" data-testid="img" />);
    expect(screen.getByTestId('img')).toHaveClass('mi-clase');
  });
});
