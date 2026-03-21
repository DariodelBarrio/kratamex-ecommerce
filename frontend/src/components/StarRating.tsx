import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getValoraciones, postValoracion } from '../api'
import { t } from '../i18n'
import type { Valoracion } from '../interfaces'

// =================================================================
// STAR RATING — Display component
// =================================================================
interface StarRatingProps {
  rating: number
  count?: number
  size?: number
}

export function StarRating({ rating, count, size = 16 }: StarRatingProps) {
  const stars = []
  const clamped = Math.max(0, Math.min(5, rating))

  for (let i = 1; i <= 5; i++) {
    const filled = clamped >= i
    const half = !filled && clamped >= i - 0.5

    stars.push(
      <span key={i} style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
        {/* Background (empty) star */}
        <Star
          size={size}
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1.5}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
        {/* Filled or half-filled star */}
        {filled && (
          <Star
            size={size}
            fill="#f59e0b"
            stroke="#f59e0b"
            strokeWidth={1.5}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
        )}
        {half && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '50%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Star
              size={size}
              fill="#f59e0b"
              stroke="#f59e0b"
              strokeWidth={1.5}
            />
          </span>
        )}
      </span>
    )
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
        {stars}
      </span>
      {count != null && (
        <span style={{ fontSize: size * 0.75, color: 'var(--text-muted, #64748b)', marginLeft: 4 }}>
          ({count})
        </span>
      )}
    </span>
  )
}

// =================================================================
// RATING FORM — Submit / edit ratings
// =================================================================
interface RatingFormProps {
  productoId: number
  onSubmit?: () => void
}

export function RatingForm({ productoId, onSubmit }: RatingFormProps) {
  const queryClient = useQueryClient()
  const [puntuacion, setPuntuacion] = useState(0)
  const [hoverIndex, setHoverIndex] = useState(0)
  const [titulo, setTitulo] = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')

  const isLoggedIn = !!localStorage.getItem('kratamex_token')

  const mutation = useMutation({
    mutationFn: (data: { puntuacion: number; titulo?: string; comentario?: string }) =>
      postValoracion(productoId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valoraciones', productoId] })
      setPuntuacion(0)
      setTitulo('')
      setComentario('')
      setError('')
      onSubmit?.()
    },
    onError: (err: Error) => setError(err.message),
  })

  const handleSubmit = () => {
    setError('')
    if (puntuacion === 0) {
      setError('Selecciona una puntuaci\u00f3n')
      return
    }
    mutation.mutate({
      puntuacion,
      titulo: titulo.trim() || undefined,
      comentario: comentario.trim() || undefined,
    })
  }

  if (!isLoggedIn) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          padding: '16px 20px',
          borderRadius: 10,
          background: 'var(--surface-secondary, #f1f5f9)',
          color: 'var(--text-muted, #64748b)',
          fontSize: '0.9rem',
          textAlign: 'center',
        }}
      >
        {t('rating.loginRequired')}
      </motion.div>
    )
  }

  const activeRating = hoverIndex || puntuacion

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        padding: '20px',
        borderRadius: 12,
        background: 'var(--surface-secondary, #f8fafc)',
        border: '1px solid var(--border, #e2e8f0)',
      }}
    >
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '1rem',
        fontWeight: 600,
        color: 'var(--text-primary, #0f172a)',
      }}>
        {t('rating.write')}
      </h3>

      {/* Star selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <motion.button
            key={i}
            type="button"
            onClick={() => setPuntuacion(i)}
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(0)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              display: 'inline-flex',
              lineHeight: 1,
            }}
          >
            <Star
              size={26}
              fill={i <= activeRating ? '#f59e0b' : 'none'}
              stroke={i <= activeRating ? '#f59e0b' : '#d1d5db'}
              strokeWidth={1.5}
              style={{ transition: 'fill 0.15s, stroke 0.15s' }}
            />
          </motion.button>
        ))}
      </div>

      {/* Title field */}
      <input
        type="text"
        placeholder={t('rating.titleField')}
        value={titulo}
        onChange={e => setTitulo(e.target.value)}
        maxLength={150}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--border, #e2e8f0)',
          background: 'var(--surface, #fff)',
          color: 'var(--text-primary, #0f172a)',
          fontSize: '0.9rem',
          outline: 'none',
          marginBottom: 10,
          boxSizing: 'border-box',
        }}
      />

      {/* Comment textarea */}
      <textarea
        placeholder={t('rating.comment')}
        value={comentario}
        onChange={e => setComentario(e.target.value)}
        maxLength={1000}
        rows={4}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--border, #e2e8f0)',
          background: 'var(--surface, #fff)',
          color: 'var(--text-primary, #0f172a)',
          fontSize: '0.9rem',
          outline: 'none',
          resize: 'vertical',
          marginBottom: 12,
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        {error && (
          <span style={{ fontSize: '0.82rem', color: '#ef4444' }}>{error}</span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <motion.button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #6366f1)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.7 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {mutation.isPending ? t('general.loading') : t('rating.submit')}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// =================================================================
// VALORACIONES LIST — Show ratings for a product
// =================================================================
interface ValoracionesListProps {
  productoId: number
}

export function ValoracionesList({ productoId }: ValoracionesListProps) {
  const { data: valoraciones = [], isLoading } = useQuery<Valoracion[]>({
    queryKey: ['valoraciones', productoId],
    queryFn: () => getValoraciones(productoId),
  })

  const formatFecha = (fecha: string) =>
    new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  const iniciales = (nombre: string) =>
    nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              padding: 16,
              borderRadius: 10,
              background: 'var(--surface-secondary, #f8fafc)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--border, #e2e8f0)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: '30%', height: 13, background: 'var(--border, #e2e8f0)', borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: '100%', height: 11, background: 'var(--border, #e2e8f0)', borderRadius: 4, marginBottom: 5 }} />
              <div style={{ width: '70%', height: 11, background: 'var(--border, #e2e8f0)', borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (valoraciones.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px 16px',
        color: 'var(--text-muted, #64748b)',
        fontSize: '0.9rem',
      }}>
        <Star size={36} style={{ opacity: 0.15, marginBottom: 8 }} />
        <p>{t('rating.noRatings')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AnimatePresence>
        {valoraciones.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: 'flex',
              gap: 14,
              padding: '16px',
              borderRadius: 10,
              background: 'var(--surface-secondary, #f8fafc)',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            {/* Avatar */}
            {v.avatar ? (
              <img
                src={v.avatar}
                alt={v.username}
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  objectFit: 'cover', flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent, #6366f1)',
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
              }}>
                {iniciales(v.username)}
              </div>
            )}

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                flexWrap: 'wrap', marginBottom: 4,
              }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  color: 'var(--text-primary, #0f172a)',
                }}>
                  {v.username}
                </span>
                <StarRating rating={v.puntuacion} size={13} />
                <span style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted, #94a3b8)',
                  marginLeft: 'auto',
                }}>
                  {formatFecha(v.fecha)}
                </span>
              </div>

              {v.titulo && (
                <p style={{
                  margin: '4px 0 2px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  color: 'var(--text-primary, #0f172a)',
                }}>
                  {v.titulo}
                </p>
              )}

              {v.comentario && (
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary, #475569)',
                  lineHeight: 1.5,
                }}>
                  {v.comentario}
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
