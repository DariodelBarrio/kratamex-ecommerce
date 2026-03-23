import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Introduce tu email'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.ok) { setDone(true); }
      else { const d = await res.json(); setError(d.error || 'Error al enviar'); }
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
            <CheckCircle size={44} style={{ color: '#10b981', marginBottom: 16 }} />
            <h2 style={title}>Email enviado</h2>
            <p style={sub}>
              Te hemos enviado un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y, si no aparece, la carpeta de spam.
            </p>
            <Link to="/login" style={link}><ArrowLeft size={14} /> Volver al login</Link>
          </>
        ) : (
          <>
            <Mail size={44} style={{ color: '#2563eb', marginBottom: 16 }} />
            <h2 style={title}>¿Olvidaste tu contraseña?</h2>
            <p style={sub}>Introduce tu email y te enviaremos un enlace para restablecerla.</p>

            <input
              type="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={input}
              autoFocus
            />
            {error && <p style={errStyle}>{error}</p>}

            <button onClick={handleSubmit} disabled={loading} style={btn}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <Link to="/login" style={link}><ArrowLeft size={14} /> Volver al login</Link>
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
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
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
const link: React.CSSProperties = {
  color: '#64748b', fontSize: '0.83rem', textDecoration: 'none',
  display: 'flex', alignItems: 'center', gap: 5, marginTop: 4,
};
