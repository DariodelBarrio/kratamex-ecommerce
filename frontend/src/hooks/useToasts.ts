import { useState, useCallback } from 'react'

export interface Toast { id: number; nombre: string }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const scheduleRemoval = useCallback((id: number) => {
    setTimeout(() => removeToast(id), 2600)
  }, [removeToast])

  const addToast = useCallback((nombre: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, nombre }])
    scheduleRemoval(id)
  }, [scheduleRemoval])

  return { toasts, addToast }
}
