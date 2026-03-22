import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { login, register } from '../api';
import { t } from '../i18n';
import { PasswordStrength } from './PasswordStrength';

// =================================================================
// AUTH — Login / Register with glassmorphism
// =================================================================

interface AuthProps {
  onAuth: (data: { token: string; user: any }) => void;
  defaultMode?: 'login' | 'register';
}

export default function Auth({ onAuth, defaultMode = 'login' }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data: { token: string; user: any };

      if (mode === 'login') {
        data = await login(username, password);
      } else {
        data = await register({
          username,
          password,
          email,
          nombre: nombre || undefined,
        });
      }

      localStorage.setItem('kratamex_token', data.token);
      onAuth(data);
    } catch (err: any) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(m => (m === 'login' ? 'register' : 'login'));
    setError('');
  };

  const isRegister = mode === 'register';

  return (
    <div style={styles.backdrop}>
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          style={styles.card}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.iconCircle}>
              {isRegister ? <UserPlus size={22} /> : <LogIn size={22} />}
            </div>
            <h2 style={styles.title}>
              {isRegister ? t('auth.register') : t('auth.login')}
            </h2>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                style={styles.error}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Username */}
            <label style={styles.label}>{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={styles.input}
              placeholder={t('auth.username')}
            />

            {/* Email (register) */}
            {isRegister && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label style={styles.label}>{t('auth.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  style={styles.input}
                  placeholder={t('auth.email')}
                />
              </motion.div>
            )}

            {/* Name (register) */}
            {isRegister && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label style={styles.label}>{t('auth.name')}</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  autoComplete="name"
                  style={styles.input}
                  placeholder={t('auth.name')}
                />
              </motion.div>
            )}

            {/* Password */}
            <label style={styles.label}>{t('auth.password')}</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                style={{ ...styles.input, paddingRight: 44 }}
                placeholder={t('auth.password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={styles.eyeButton}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength indicator (register only) */}
            {isRegister && <PasswordStrength password={password} />}

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.65 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
            >
              {loading ? (
                <span style={styles.spinner} />
              ) : isRegister ? (
                <UserPlus size={16} />
              ) : (
                <LogIn size={16} />
              )}
              <span>
                {loading
                  ? t('general.loading')
                  : isRegister
                    ? t('auth.register')
                    : t('auth.login')}
              </span>
            </motion.button>

            {!isRegister && (
              <Link to="/forgot-password" style={{ display: 'block', textAlign: 'center', marginTop: 12, color: '#94a3b8', fontSize: '0.82rem', textDecoration: 'none' }}>
                ¿Olvidaste tu contraseña?
              </Link>
            )}
          </form>

          {/* Toggle mode */}
          <p style={styles.toggle}>
            {isRegister ? t('auth.hasAccount') : t('auth.noAccount')}{' '}
            <button type="button" onClick={toggleMode} style={styles.toggleLink}>
              {isRegister ? t('auth.loginHere') : t('auth.registerHere')}
            </button>
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// =================================================================
// STYLES — inline, using project CSS custom properties
// =================================================================

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70vh',
    padding: 24,
  },

  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--surface)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '36px 32px 28px',
    boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
  },

  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'var(--primary-glow)',
    color: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
  },

  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    color: 'var(--error)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    fontSize: '0.8125rem',
    fontWeight: 500,
    marginBottom: 16,
    overflow: 'hidden',
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  label: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginTop: 12,
    marginBottom: 4,
  },

  input: {
    width: '100%',
    padding: '11px 14px',
    background: 'var(--surface-solid)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text)',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.25s, box-shadow 0.25s',
  },

  passwordWrapper: {
    position: 'relative',
  },

  eyeButton: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButton: {
    marginTop: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    padding: '12px 0',
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    letterSpacing: '-0.1px',
    transition: 'opacity 0.2s',
  },

  spinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },

  toggle: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: '0.8125rem',
    color: 'var(--text-muted)',
  },

  toggleLink: {
    background: 'none',
    border: 'none',
    color: 'var(--primary-light)',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'inherit',
    fontSize: '0.8125rem',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
  },
};
