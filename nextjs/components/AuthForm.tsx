'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, UserPlus, Eye, EyeOff, X } from 'lucide-react'
import * as api from '@/lib/api'

// =================================================================
// PASSWORD STRENGTH
// =================================================================
function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length

  const labels = ['', 'Débil', 'Regular', 'Buena', 'Fuerte']
  const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981']

  if (!password) return null
  return (
    <div className="password-strength">
      <div className="password-strength-bars">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="password-strength-bar"
            style={{ background: i <= score ? colors[score] : undefined }} />
        ))}
      </div>
      <span className="password-strength-label" style={{ color: colors[score] }}>{labels[score]}</span>
    </div>
  )
}

// =================================================================
// AUTH FORM — shared by /login and /registro
// =================================================================
interface AuthFormProps {
  defaultMode: 'login' | 'register'
  onAuth: (data: { token: string; user: any }) => void
  onDone: () => void
}

export function AuthForm({ defaultMode, onAuth, onDone }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [nombre, setNombre] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data: { token: string; user: any }
      if (mode === 'login') {
        data = await api.login(username, password)
      } else {
        data = await api.register({ username, password, email, nombre: nombre || undefined })
      }
      onAuth(data)
      onDone()
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: 24 }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '36px 32px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.35)', position: 'relative' }}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          <Link href="/" style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '50%', background: 'var(--surface-solid)', border: '1px solid var(--border)', color: 'var(--text-muted)', textDecoration: 'none' }}>
            <X size={18} />
          </Link>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isRegister ? <UserPlus size={22} /> : <LogIn size={22} />}
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
              {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
            </h2>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 16, overflow: 'hidden' }}
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="checkout-form-label" style={{ marginTop: 12 }}>Usuario</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" className="form-input" placeholder="Usuario" />

            {isRegister && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <label className="checkout-form-label" style={{ marginTop: 12, display: 'block' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="form-input" placeholder="Email" style={{ width: '100%' }} />
                <label className="checkout-form-label" style={{ marginTop: 12, display: 'block' }}>Nombre completo</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} autoComplete="name" className="form-input" placeholder="Nombre completo" style={{ width: '100%' }} />
              </motion.div>
            )}

            <label className="checkout-form-label" style={{ marginTop: 12 }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete={isRegister ? 'new-password' : 'current-password'}
                className="form-input" placeholder="Contraseña" style={{ width: '100%', paddingRight: 44 }}
              />
              <button type="button" onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {isRegister && <PasswordStrength password={password} />}

            <motion.button
              type="submit" disabled={loading}
              style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 0', background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1 }}
              whileHover={{ scale: loading ? 1 : 1.02 }} whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading
                ? <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                : (isRegister ? <UserPlus size={16} /> : <LogIn size={16} />)
              }
              <span>{loading ? 'Cargando...' : (isRegister ? 'Crear cuenta' : 'Iniciar sesión')}</span>
            </motion.button>

            {!isRegister && (
              <Link href="/forgot-password" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: '#94a3b8', fontSize: '0.82rem', textDecoration: 'none' }}>
                ¿Olvidaste tu contraseña?
              </Link>
            )}
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
            <button type="button" onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '0.8125rem', textDecoration: 'underline', textUnderlineOffset: 2 }}>
              {isRegister ? 'Inicia sesión' : 'Regístrate aquí'}
            </button>
          </p>
        </motion.div>
      </AnimatePresence>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
