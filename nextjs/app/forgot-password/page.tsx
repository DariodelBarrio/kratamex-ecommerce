'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }
const titleStyle: React.CSSProperties = { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }
const subStyle: React.CSSProperties   = { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }
const linkStyle: React.CSSProperties  = { color: 'var(--text-subtle)', fontSize: '0.83rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]     = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Introduce tu email'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) })
      if (res.ok) { setDone(true) }
      else { const d = await res.json(); setError(d.error || 'Error al enviar') }
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={box}>
        {done ? (
          <>
            <CheckCircle size={44} style={{ color: '#10b981', marginBottom: 16 }} />
            <h2 style={titleStyle}>Email enviado</h2>
            <p style={subStyle}>Si ese email está registrado, recibirás un enlace en breve. Revisa también la carpeta de spam.</p>
            <Link href="/login" style={linkStyle}><ArrowLeft size={14} /> Volver al login</Link>
          </>
        ) : (
          <>
            <Mail size={44} style={{ color: 'var(--primary)', marginBottom: 16 }} />
            <h2 style={titleStyle}>¿Olvidaste tu contraseña?</h2>
            <p style={subStyle}>Introduce tu email y te enviaremos un enlace para restablecerla.</p>
            <input type="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} className="form-input" style={{ width: '100%' }} autoFocus />
            {error && <p style={{ margin: 0, color: 'var(--error)', fontSize: '0.83rem' }}>{error}</p>}
            <button onClick={handleSubmit} disabled={loading} className="checkout-btn" style={{ width: '100%' }}>
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <Link href="/login" style={linkStyle}><ArrowLeft size={14} /> Volver al login</Link>
          </>
        )}
      </div>
    </div>
  )
}
