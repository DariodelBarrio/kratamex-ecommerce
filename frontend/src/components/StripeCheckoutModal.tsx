import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { motion } from 'framer-motion'
import { X, Lock } from 'lucide-react'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

interface Props {
  readonly clientSecret: string
  readonly pedidoId: number
  readonly total: number
  readonly onSuccess: () => void
  readonly onClose: () => void
}

function CheckoutForm({ pedidoId, total, onSuccess, onClose }: Readonly<Omit<Props, 'clientSecret'>>) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError('')

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${globalThis.location.origin}/mis-pedidos` },
      redirect: 'if_required',
    })

    if (result.error) {
      setError(result.error.message || 'Error al procesar el pago')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stripe-modal-form">
      <div className="stripe-modal-header">
        <div>
          <h2 className="stripe-modal-title">Pago seguro</h2>
          <p className="stripe-modal-subtitle">Pedido #{pedidoId} · Total: <strong>€{total.toFixed(2)}</strong></p>
        </div>
        <button type="button" className="cart-close-btn" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
      </div>

      <div className="stripe-payment-element">
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {error && <p className="stripe-error" role="alert">{error}</p>}

      <button type="submit" className="checkout-btn" disabled={!stripe || loading}>
        {loading ? 'Procesando...' : `Pagar €${total.toFixed(2)}`}
      </button>

      <p className="stripe-secure-note">
        <Lock size={12} style={{ display: 'inline', marginRight: 4 }} />
        Pago procesado de forma segura por Stripe. No almacenamos datos de tarjeta.
      </p>
    </form>
  )
}

export function StripeCheckoutModal({ clientSecret, pedidoId, total, onSuccess, onClose }: Readonly<Props>) {
  return (
    <motion.div
      className="stripe-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="stripe-modal"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.95, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 16 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      >
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: { colorPrimary: '#2563eb', borderRadius: '10px' },
            },
          }}
        >
          <CheckoutForm pedidoId={pedidoId} total={total} onSuccess={onSuccess} onClose={onClose} />
        </Elements>
      </motion.div>
    </motion.div>
  )
}