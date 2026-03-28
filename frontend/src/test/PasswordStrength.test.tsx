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

  it('muestra "Aceptable" para contraseña con longitud, mayúsculas y dígito', () => {
    // score=3: length>=8 ✓, lowercase+uppercase ✓, digit ✓
    render(<PasswordStrength password="Abcdefg12" />);
    expect(screen.getByText('Aceptable')).toBeInTheDocument();
  });

  it('muestra "Muy fuerte" para contraseña con todos los criterios', () => {
    // score=5: all criteria met
    render(<PasswordStrength password="MiContra!123abc" />);
    expect(screen.getByText('Muy fuerte')).toBeInTheDocument();
  });

  it('muestra "Muy débil" para contraseña solo con longitud', () => {
    // score=1: solo length>=8
    render(<PasswordStrength password="abcdefgh" />);
    expect(screen.getByText('Muy débil')).toBeInTheDocument();
  });

  it('renderiza 5 barras de fortaleza', () => {
    const { container } = render(<PasswordStrength password="test" />);
    expect(container.querySelectorAll('.password-strength-bar').length).toBe(5);
  });

  it('muestra la etiqueta de fortaleza con color', () => {
    render(<PasswordStrength password="MiPass123!" />);
    const label = screen.getByText('Fuerte');
    expect(label).toHaveStyle({ color: '#22c55e' });
  });
});
