import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    Object.getOwnPropertyDescriptor(window.Image.prototype, 'onerror')?.value?.call(img);
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
    img.dispatchEvent(new Event('load'));
    
    await waitFor(() => {
      expect(img).toHaveAttribute('src', 'test.jpg');
    });
  });
});
