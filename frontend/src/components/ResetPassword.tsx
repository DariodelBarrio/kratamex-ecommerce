import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token    = params.get('token') ?? '';

  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  if (!token) {
    return (
      <div style={wrap}>
        <div style={box}>
          <AlertCircle size={44} style={{ color: '#ef4444', marginBottom: 12 }} />
          <h2 style={title}>Enlace inválido</h2>
          <p style={sub}>Este enlace no es válido. Solicita uno nuevo.</p>
          <Link to="/forgot-password" style={linkBtn}>Solicitar nuevo enlace</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!password) { setError('Introduce una contraseña'); return; }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const d = await res.json();
      if (res.ok) { setDone(true); }
      else { setError(d.error || 'Error al restablecer'); }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={box}>
        {done ? (
          <>
            <CheckCircle size={44} style={{ color: '#10b981', marginBottom: 12 }} />
            <h2 style={title}>Contraseña actualizada</h2>
            <p style={sub}>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <Link to="/login" style={linkBtn}>Ir al login</Link>
          </>
        ) : (
          <>
            <KeyRound size={44} style={{ color: '#2563eb', marginBottom: 12 }} />
            <h2 style={title}>Nueva contraseña</h2>
            <p style={sub}>Elige una contraseña segura de al menos 8 caracteres.</p>

            <input
              type="password"
              placeholder="Nueva contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={input}
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={input}
            />
            {error && <p style={errStyle}>{error}</p>}

            <button onClick={handleSubmit} disabled={loading} style={btn}>
              {loading ? 'Guardando...' : 'Establecer contraseña'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center',
  justifyContent: 'center', background: '#f8fafc', padding: 20,
};
const box: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: '48px 40px',
  maxWidth: 420, width: '100%', textAlign: 'center',
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
};
const title: React.CSSProperties = { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' };
const sub: React.CSSProperties   = { margin: 0, color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 };
const input: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 8, fontSize: '0.95rem',
  border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit', color: '#0f172a',
};
const btn: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 8, background: '#2563eb',
  color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.95rem',
  cursor: 'pointer', fontFamily: 'inherit',
};
const errStyle: React.CSSProperties = { margin: 0, color: '#ef4444', fontSize: '0.83rem' };
const linkBtn: React.CSSProperties = {
  display: 'inline-block', marginTop: 8, padding: '10px 24px', borderRadius: 8,
  background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.9rem',
  textDecoration: 'none',
};
