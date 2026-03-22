import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrength } from '../components/PasswordStrength';

describe('PasswordStrength', () => {
  it('no renderiza nada con contraseña vacía', () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('muestra "Muy débil" para contraseñas cortas sin complejidad', () => {
    render(<PasswordStrength password="abc" />);
    expect(screen.getByText('Muy débil')).toBeInTheDocument();
  });

  it('muestra "Débil" para contraseña con longitud y un dígito', () => {
    render(<PasswordStrength password="abcdefg1" />);
    expect(screen.getByText('Débil')).toBeInTheDocument();
  });

  it('muestra "Fuerte" para contraseñas con mayúsculas, números y símbolo', () => {
    render(<PasswordStrength password="MiPass123!" />);
    expect(screen.getByText('Fuerte')).toBeInTheDocument();
  });
});
