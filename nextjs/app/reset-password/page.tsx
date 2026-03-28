'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, CheckCircle, AlertCircle } from 'lucide-react'

const box: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }
const titleStyle: React.CSSProperties = { margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }
const subStyle: React.CSSProperties   = { margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }
const linkBtnStyle: React.CSSProperties = { display: 'inline-block', marginTop: 8, padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState('')

  if (!token) {
    return (
      <div style={box}>
        <AlertCircle size={44} style={{ color: 'var(--error)', marginBottom: 12 }} />
        <h2 style={titleStyle}>Enlace inválido</h2>
        <p style={subStyle}>Este enlace no es válido. Solicita uno nuevo.</p>
        <Link href="/forgot-password" style={linkBtnStyle}>Solicitar nuevo enlace</Link>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!password) { setError('Introduce una contraseña'); return }
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
      const d = await res.json()
      if (res.ok) { setDone(true) } else { setError(d.error || 'Error al restablecer') }
    } catch { setError('Error de conexión') }
    finally { setLoading(false) }
  }

  return (
    <div style={box}>
      {done ? (
        <>
          <CheckCircle size={44} style={{ color: '#10b981', marginBottom: 12 }} />
          <h2 style={titleStyle}>Contraseña actualizada</h2>
          <p style={subStyle}>Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <Link href="/login" style={linkBtnStyle}>Ir al login</Link>
        </>
      ) : (
        <>
          <KeyRound size={44} style={{ color: 'var(--primary)', marginBottom: 12 }} />
          <h2 style={titleStyle}>Nueva contraseña</h2>
          <p style={subStyle}>Elige una contraseña segura de al menos 8 caracteres.</p>
          <input type="password" placeholder="Nueva contraseña" value={password} onChange={e => setPassword(e.target.value)} className="form-input" style={{ width: '100%' }} autoFocus />
          <input type="password" placeholder="Confirmar contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} className="form-input" style={{ width: '100%' }} />
          {error && <p style={{ margin: 0, color: 'var(--error)', fontSize: '0.83rem' }}>{error}</p>}
          <button onClick={handleSubmit} disabled={loading} className="checkout-btn" style={{ width: '100%' }}>
            {loading ? 'Guardando...' : 'Establecer contraseña'}
          </button>
        </>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
