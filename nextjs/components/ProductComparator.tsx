'use client'

import { motion } from 'framer-motion'
import { X, Cpu, HardDrive, MemoryStick, Monitor } from 'lucide-react'
import type { Producto } from '@/lib/types'

interface ProductComparatorProps {
  productos: Producto[]
  onRemove: (id: number) => void
  onClear: () => void
  onClose: () => void
}

const SPECS = [
  { key: 'precio', label: 'Precio', icon: null },
  { key: 'cpu', label: 'Procesador', icon: Cpu },
  { key: 'gpu', label: 'Gráficos', icon: Monitor },
  { key: 'ram', label: 'Memoria RAM', icon: MemoryStick },
  { key: 'almacenamiento', label: 'Almacenamiento', icon: HardDrive },
  { key: 'categoria', label: 'Categoría', icon: null },
  { key: 'stock', label: 'Disponibilidad', icon: null },
] as const

function getStockLabel(stock: number): string {
  if (stock === 0) return 'Sin stock'
  if (stock <= 5) return `Solo ${stock} unidades`
  return 'En stock'
}

function getStockClass(stock: number): string {
  if (stock === 0) return 'out-of-stock'
  if (stock <= 5) return 'low-stock'
  return 'in-stock'
}

export function ProductComparator({ productos, onRemove, onClear, onClose }: ProductComparatorProps) {
  if (productos.length === 0) return null

  return (
    <motion.div
      className="comparador-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="comparador-container"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="comparador-header">
          <h2 className="comparador-title">Comparar productos</h2>
          <div className="comparador-actions">
            {productos.length > 0 && (
              <button className="comparador-clear-btn" onClick={onClear}>
                Limpiar todo
              </button>
            )}
            <button className="comparador-close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="comparador-table-wrap">
          <table className="comparador-table">
            <thead>
              <tr>
                <th className="spec-label"></th>
                {productos.map(p => (
                  <th key={p.id} className="product-col">
                    <div className="product-col-header">
                      <button
                        className="remove-product-btn"
                        onClick={() => onRemove(p.id)}
                        aria-label="Quitar producto"
                      >
                        <X size={14} />
                      </button>
                      <div className="product-col-image">
                        {p.imagen ? (
                          <img src={p.imagen} alt={p.nombre} />
                        ) : (
                          <div className="image-placeholder" />
                        )}
                      </div>
                      <h3 className="product-col-name">{p.nombre}</h3>
                    </div>
                  </th>
                ))}
                {Array.from({ length: 3 - productos.length }).map((_, i) => (
                  <th key={`empty-${i}`} className="product-col empty-col">
                    <div className="empty-slot">
                      <span>Selecciona un producto</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SPECS.map(spec => {
                const Icon = spec.icon
                return (
                  <tr key={spec.key}>
                    <td className="spec-label">
                      {Icon && <Icon size={16} />}
                      {spec.label}
                    </td>
                    {productos.map(p => (
                      <td key={p.id} className="spec-value">
                        {spec.key === 'precio' && (
                          <span className="price-value">${p.precio.toFixed(2)}</span>
                        )}
                        {spec.key === 'stock' && (
                          <span className={`stock-badge ${getStockClass(p.stock)}`}>
                            {getStockLabel(p.stock)}
                          </span>
                        )}
                        {spec.key === 'categoria' && p.categoria}
                        {spec.key !== 'precio' && spec.key !== 'stock' && spec.key !== 'categoria' && (
                          p[spec.key as keyof Producto] || '—'
                        )}
                      </td>
                    ))}
                    {Array.from({ length: 3 - productos.length }).map((_, i) => (
                      <td key={`empty-${i}`} className="spec-value empty">—</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  )
}
