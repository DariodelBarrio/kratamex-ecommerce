'use client'

import { useState, useCallback } from 'react'

export interface Toast { id: number; nombre: string }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((nombre: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, nombre }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600)
  }, [])

  return { toasts, addToast }
}
