import { useMemo } from 'react';

// =================================================================
// PASSWORD STRENGTH — Real-time visual password strength indicator
// =================================================================

interface PasswordStrengthProps {
  password: string;
}

function calculateStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '#334155' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Muy débil', color: '#ef4444' };
  if (score === 2) return { score, label: 'Débil', color: '#f97316' };
  if (score === 3) return { score, label: 'Aceptable', color: '#eab308' };
  if (score === 4) return { score, label: 'Fuerte', color: '#22c55e' };
  return { score, label: 'Muy fuerte', color: '#10b981' };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label, color } = useMemo(() => calculateStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="password-strength">
      <div className="password-strength-bars">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className="password-strength-bar"
            style={{
              background: i <= score ? color : '#334155',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
      <span className="password-strength-label" style={{ color }}>{label}</span>
    </div>
  );
}
