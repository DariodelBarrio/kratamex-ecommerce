import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

function CheckoutForm({ total, onSuccess, onCancel }: {
  total: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.origin + '/mis-pedidos' },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message || 'Error al procesar el pago')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <PaymentElement />
      {error && (
        <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '4px 0 0', padding: '8px 10px', background: 'rgba(248,113,113,0.1)', borderRadius: '6px' }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary"
          style={{ flex: 1 }}
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={loading || !stripe || !elements}
          className="checkout-btn"
          style={{ flex: 2 }}
        >
          {loading ? 'Procesando...' : `Pagar €${total.toFixed(2)}`}
        </button>
      </div>
    </form>
  )
}

export default function Checkout({ clientSecret, total, onSuccess, onCancel }: {
  clientSecret: string
  total: number
  onSuccess: () => void
  onCancel: () => void
}) {
  const appearance = {
    theme: 'night' as const,
    variables: {
      colorPrimary: '#2563eb',
      colorBackground: '#1a1a2e',
      colorText: '#e2e8f0',
      colorDanger: '#f87171',
      borderRadius: '8px',
      fontFamily: 'inherit',
    },
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
      <div style={{ padding: '4px 0' }}>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 600 }}>Pago seguro</h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Total: <strong>€{total.toFixed(2)}</strong> · Cifrado con TLS
          </p>
        </div>
        <CheckoutForm total={total} onSuccess={onSuccess} onCancel={onCancel} />
        <p style={{ marginTop: '12px', fontSize: '0.68rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
          Modo test · Tarjeta aprobada: <code>4242 4242 4242 4242</code><br />
          Fondos insuficientes: <code>4000 0000 0000 9995</code> · CVC: 123 · CP: 12345
        </p>
      </div>
    </Elements>
  )
}
