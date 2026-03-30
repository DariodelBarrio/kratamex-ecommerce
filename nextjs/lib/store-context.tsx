'use client'

import { createContext, useContext, useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'
import type { CarritoItem, Usuario } from './types'
import * as api from './api'

interface StoreContextValue {
  // Auth
  authUser: Usuario | null
  handleAuth: (data: { token: string; user: any }) => void
  handleLogout: () => void
  // Cart
  carrito: CarritoItem[]
  setCarrito: Dispatch<SetStateAction<CarritoItem[]>>
  carritoAbierto: boolean
  setCarritoAbierto: (v: boolean) => void
  // Wishlist
  wishlist: number[]
  toggleWishlist: (id: number) => void
  // Theme
  tema: 'dark' | 'light'
  toggleTema: () => void
  // Loyalty points
  puntosParaCanjear: number
  setPuntosParaCanjear: (n: number) => void
  descuentoPuntos: number   // €€ de descuento (100 pts = 5 €)
}

const StoreContext = createContext<StoreContextValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<'dark' | 'light'>('dark')
  const [authUser, setAuthUser] = useState<Usuario | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const token = localStorage.getItem('kratamex_token')
      const saved = localStorage.getItem('kratamex_user')
      if (token && saved) return JSON.parse(saved)
    } catch {}
    return null
  })
  const [carrito, setCarrito] = useState<CarritoItem[]>([])
  const [carritoAbierto, setCarritoAbierto] = useState(false)
  const [wishlist, setWishlist] = useState<number[]>([])
  const [puntosParaCanjear, setPuntosParaCanjear] = useState(0)

  // Hydrate from localStorage (client-only)
  useEffect(() => {
    const savedTema = (localStorage.getItem('kratamex_tema') as 'dark' | 'light') || 'dark'
    setTema(savedTema)

    try {
      const savedCart = JSON.parse(localStorage.getItem('kratamex_cart') || '[]')
      setCarrito(savedCart)
    } catch {}

    try {
      const savedWishlist = JSON.parse(localStorage.getItem('kratamex_wishlist') || '[]')
      setWishlist(savedWishlist)
    } catch {}

    const token = localStorage.getItem('kratamex_token')
    const saved = localStorage.getItem('kratamex_user')
    if (!token || !saved) return

    fetch('/api/usuario', { headers: { Authorization: token } }).then(r => {
      if (r.ok) {
        try { setAuthUser(JSON.parse(saved)) } catch {}
      } else {
        localStorage.removeItem('kratamex_token')
        localStorage.removeItem('kratamex_user')
      }
    }).catch(() => {
      try { setAuthUser(JSON.parse(saved)) } catch {}
    })
  }, [])

  // Persist tema
  useEffect(() => {
    document.documentElement.dataset['tema'] = tema
    localStorage.setItem('kratamex_tema', tema)
  }, [tema])

  // Persist cart
  useEffect(() => {
    localStorage.setItem('kratamex_cart', JSON.stringify(carrito))
  }, [carrito])

  // Persist wishlist
  useEffect(() => {
    localStorage.setItem('kratamex_wishlist', JSON.stringify(wishlist))
  }, [wishlist])

  const handleAuth = useCallback((data: { token: string; user: any }) => {
    localStorage.setItem('kratamex_token', data.token)
    localStorage.setItem('kratamex_user', JSON.stringify(data.user))
    setAuthUser(data.user)
  }, [])

  const handleLogout = useCallback(() => {
    const token = localStorage.getItem('kratamex_token') || ''
    localStorage.removeItem('kratamex_token')
    localStorage.removeItem('kratamex_user')
    setAuthUser(null)
    fetch('/api/logout', { method: 'POST', headers: { Authorization: token } }).catch(() => {})
  }, [])

  const toggleWishlist = useCallback((id: number) => {
    setWishlist(prev => {
      const isFav = prev.includes(id)
      const next = isFav ? prev.filter(x => x !== id) : [...prev, id]
      return next
    })
    // Sync to API if logged in — read from state via closure
    setAuthUser(current => {
      if (current) {
        const isFav = wishlist.includes(id)
        if (isFav) api.removeFavorito(id).catch(() => {})
        else api.addFavorito(id).catch(() => {})
      }
      return current
    })
  }, [wishlist])

  const toggleTema = useCallback(() => {
    setTema(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  const descuentoPuntos = Math.round((puntosParaCanjear / 100) * 5 * 100) / 100

  return (
    <StoreContext.Provider value={{
      authUser, handleAuth, handleLogout,
      carrito, setCarrito,
      carritoAbierto, setCarritoAbierto,
      wishlist, toggleWishlist,
      tema, toggleTema,
      puntosParaCanjear, setPuntosParaCanjear, descuentoPuntos,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
