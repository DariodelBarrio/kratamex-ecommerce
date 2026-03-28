'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Producto } from '@/lib/types'

const MAX_PRODUCTOS = 3
const STORAGE_KEY = 'kratamex_comparar'

export interface UseComparadorReturn {
  productosSeleccionados: Producto[]
  agregarProducto: (producto: Producto) => boolean
  eliminarProducto: (id: number) => void
  limpiarComparador: () => void
  puedeAgregar: boolean
  estaEnComparador: (id: number) => boolean
}

export function useComparador(): UseComparadorReturn {
  const [productosSeleccionados, setProductosSeleccionados] = useState<Producto[]>([])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setProductosSeleccionados(JSON.parse(saved))
      }
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(productosSeleccionados))
  }, [productosSeleccionados])

  const agregarProducto = useCallback((producto: Producto): boolean => {
    if (productosSeleccionados.length >= MAX_PRODUCTOS) {
      return false
    }
    if (productosSeleccionados.some(p => p.id === producto.id)) {
      return false
    }
    setProductosSeleccionados(prev => [...prev, producto])
    return true
  }, [productosSeleccionados])

  const eliminarProducto = useCallback((id: number) => {
    setProductosSeleccionados(prev => prev.filter(p => p.id !== id))
  }, [])

  const limpiarComparador = useCallback(() => {
    setProductosSeleccionados([])
  }, [])

  const puedeAgregar = productosSeleccionados.length < MAX_PRODUCTOS

  const estaEnComparador = useCallback((id: number) => {
    return productosSeleccionados.some(p => p.id === id)
  }, [productosSeleccionados])

  return {
    productosSeleccionados,
    agregarProducto,
    eliminarProducto,
    limpiarComparador,
    puedeAgregar,
    estaEnComparador,
  }
}
