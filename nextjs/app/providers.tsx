'use client'

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StoreProvider } from '@/lib/store-context'
import { AnimatePresence, motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

// =================================================================
// PAGE TRANSITION — fade-in suave entre rutas
// =================================================================
function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// =================================================================
// PUSH NOTIFICATIONS — solicitar permiso y suscribir
// =================================================================
function PushNotificationProvider() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

    // Solo pedir si el usuario no ha respondido aún
    if (Notification.permission !== 'default') {
      if (Notification.permission === 'granted') subscribePush()
      return
    }

    // Retardo de 5s para no interrumpir la carga inicial
    const timer = setTimeout(() => {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') subscribePush()
      })
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return null
}

async function subscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await sendSubscriptionToServer(existing)
      return
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })
    await sendSubscriptionToServer(sub)
  } catch {
    // Silencioso — el usuario puede haber bloqueado
  }
}

async function sendSubscriptionToServer(sub: PushSubscription) {
  const json = sub.toJSON()
  const token = typeof window !== 'undefined' ? localStorage.getItem('kratamex_token') : null
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
    }),
  })
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// =================================================================
// PROVIDERS
// =================================================================
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <StoreProvider>
        <PushNotificationProvider />
        <PageTransition>
          {children}
        </PageTransition>
      </StoreProvider>
    </QueryClientProvider>
  )
}
