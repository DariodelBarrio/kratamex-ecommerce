'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store-context'
import { updatePerfil, cambiarPassword, getTwoFactorStatus, setupTwoFactor, enableTwoFactor, disableTwoFactor } from '@/lib/api'
import { Shield, ShieldCheck, ShieldOff, QrCode, Key, Loader2, Star } from 'lucide-react'

export default function PerfilPage() {
  const router = useRouter()
  const { authUser } = useStore()

  if (!authUser) { router.replace('/login'); return null }

  return <PerfilForm user={authUser} />
}

function PerfilForm({ user }: { user: { username: string; email?: string; nombre?: string; telefono?: string; direccion?: string; role?: string } }) {
  const [nombre, setNombre]     = useState(user.nombre || '')
  const [email, setEmail]       = useState(user.email || '')
  const [telefono, setTelefono] = useState(user.telefono || '')
  const [direccion, setDireccion] = useState(user.direccion || '')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [twoFactorLoading, setTwoFactorLoading] = useState(true)
  const [setupData, setSetupData] = useState<{ secret: string; qr: string } | null>(null)
  const [setupCode, setSetupCode] = useState('')
  const [setupError, setSetupError] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)

  useEffect(() => {
    getTwoFactorStatus()
      .then(data => setTwoFactorEnabled(data.enabled))
      .catch(() => {})
      .finally(() => setTwoFactorLoading(false))
  }, [])

  const handleSetup = async () => {
    setSetupLoading(true)
    setSetupError('')
    try {
      const data = await setupTwoFactor()
      setSetupData(data)
    } catch (err: any) {
      setSetupError(err.message)
    } finally {
      setSetupLoading(false)
    }
  }

  const handleEnable = async () => {
    setSetupLoading(true)
    setSetupError('')
    try {
      await enableTwoFactor(setupCode)
      setTwoFactorEnabled(true)
      setSetupData(null)
      setSetupCode('')
    } catch (err: any) {
      setSetupError(err.message)
    } finally {
      setSetupLoading(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('¿Desactivar autenticación de dos factores?')) return
    const code = prompt('Ingresa el código de tu app de autenticación:')
    if (!code) return
    setSetupLoading(true)
    try {
      await disableTwoFactor(code)
      setTwoFactorEnabled(false)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSetupLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updatePerfil({ nombre, email, telefono, direccion })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const field = (label: string, value: string, onChange: (v: string) => void, type = 'text') => (
    <div className="profile-field">
      <label>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="form-input" style={{ width: '100%' }} />
    </div>
  )

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-card">
          <h2 style={{ marginBottom: 24, fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Mi perfil</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 24 }}>
            @{user.username} {user.role === 'admin' && <span className="admin-badge">Admin</span>}
          </p>

          {field('Nombre completo', nombre, setNombre)}
          {field('Email', email, setEmail, 'email')}
          {field('Teléfono', telefono, setTelefono, 'tel')}
          {field('Dirección', direccion, setDireccion)}

          {error && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: 8 }}>{error}</p>}
          {saved && <p style={{ color: 'var(--success)', fontSize: '0.8rem', marginBottom: 8 }}>Perfil actualizado</p>}

          <button onClick={handleSave} disabled={saving} className="checkout-btn" style={{ width: '100%', marginTop: 8 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

          {/* Puntos de fidelidad */}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={18} style={{ color: '#f59e0b' }} />
            Puntos de fidelidad
          </h3>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 8 }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', letterSpacing: '-1px' }}>
              {user.puntos ?? 0}
              <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>puntos</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Ganas 1 punto por cada 10 € en compras · 100 puntos = 5 € de descuento
            </p>
            {(user.puntos ?? 0) >= 100 && (
              <p style={{ fontSize: '0.8rem', color: '#10b981', marginTop: 6 }}>
                ✓ Tienes {Math.floor((user.puntos ?? 0) / 100) * 5} € disponibles para canjear en tu próxima compra
              </p>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Cambiar contraseña</h3>
          <PasswordChangeForm />

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={20} />
            Autenticación de dos factores
          </h3>
          
          {twoFactorLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="spin" />
              Verificando...
            </div>
          ) : twoFactorEnabled ? (
            <div className="twofactor-enabled">
              <div className="twofactor-status">
                <ShieldCheck size={20} />
                <span>2FA activado</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Tu cuenta está protegida con autenticación de dos factores.
              </p>
              <button onClick={handleDisable} disabled={setupLoading} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {setupLoading ? <Loader2 size={14} className="spin" /> : <ShieldOff size={14} />}
                Desactivar 2FA
              </button>
            </div>
          ) : setupData ? (
            <div className="twofactor-setup">
              <div className="qr-section">
                <img src={setupData.qr} alt="QR Code" className="qr-image" />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  Escanea este código con tu app de autenticación (Google Authenticator, Authy, etc.)
                </p>
              </div>
              <div className="secret-section">
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Key size={14} />
                  Código manual
                </label>
                <code style={{ display: 'block', padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: '0.75rem', marginTop: 4, wordBreak: 'break-all' }}>
                  {setupData.secret}
                </code>
              </div>
              <div className="verify-section">
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-subtle)' }}>
                  Ingresa el código de 6 dígitos
                </label>
                <input
                  type="text"
                  value={setupCode}
                  onChange={e => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="form-input"
                  maxLength={6}
                  style={{ width: '120px', textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.25rem', marginTop: 4 }}
                />
                {setupError && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: 6 }}>{setupError}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={handleEnable} disabled={setupLoading || setupCode.length !== 6} className="checkout-btn" style={{ flex: 1 }}>
                    {setupLoading ? <Loader2 size={16} className="spin" /> : 'Activar 2FA'}
                  </button>
                  <button onClick={() => { setSetupData(null); setSetupCode('') }} className="btn-secondary">
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="twofactor-disabled">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                Añade una capa extra de seguridad a tu cuenta.
              </p>
              <button onClick={handleSetup} disabled={setupLoading} className="checkout-btn" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {setupLoading ? <Loader2 size={16} className="spin" /> : <QrCode size={16} />}
                Configurar 2FA
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PasswordChangeForm() {
  const [pwActual, setPwActual]   = useState('')
  const [pwNueva, setPwNueva]     = useState('')
  const [pwMsg, setPwMsg]         = useState('')
  const [pwErr, setPwErr]         = useState('')

  const handlePw = async () => {
    setPwErr(''); setPwMsg('')
    if (!pwActual || !pwNueva) { setPwErr('Completa ambos campos'); return }
    try {
      await cambiarPassword(pwActual, pwNueva)
      setPwMsg('Contraseña actualizada')
      setPwActual(''); setPwNueva('')
    } catch (err: any) { setPwErr(err.message) }
  }

  return (
    <>
      <div className="profile-field">
        <label>Contraseña actual</label>
        <input type="password" value={pwActual} onChange={e => setPwActual(e.target.value)} className="form-input" style={{ width: '100%' }} />
      </div>
      <div className="profile-field">
        <label>Nueva contraseña</label>
        <input type="password" value={pwNueva} onChange={e => setPwNueva(e.target.value)} className="form-input" style={{ width: '100%' }} />
      </div>
      {pwErr && <p style={{ color: 'var(--error)', fontSize: '0.8rem' }}>{pwErr}</p>}
      {pwMsg && <p style={{ color: 'var(--success)', fontSize: '0.8rem' }}>{pwMsg}</p>}
      <button onClick={handlePw} className="btn-secondary" style={{ marginTop: 8 }}>Cambiar contraseña</button>
    </>
  )
}
