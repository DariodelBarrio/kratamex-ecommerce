'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Truck, Shield, Package, ArrowDown, UserPlus, Star } from 'lucide-react'
import { ParticleCanvas } from './ParticleCanvas'

interface StoreHeroProps {
  readonly onScrollToProductos: () => void
  readonly authUser?: { username: string; role: string } | null
}

export function StoreHero({ onScrollToProductos, authUser }: StoreHeroProps) {
  return (
    <div className="container">
      <motion.div
        className="hero"
        style={{ position: 'relative' }}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <ParticleCanvas />
        <motion.div
          className="hero-eyebrow"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Star size={10} fill="currentColor" />{' '}
          Tecnología de primer nivel
        </motion.div>

        <motion.h1
          className="hero-title"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          Equipos para<br />
          <span className="highlight">profesionales</span>
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          Laptops y accesorios de alta gama para quienes exigen rendimiento sin compromisos.
        </motion.p>

        <motion.div
          className="hero-cta-group"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <button className="hero-cta" onClick={onScrollToProductos}>
            Ver catálogo
            <ArrowDown size={16} className="hero-cta-arrow" />
          </button>
          {!authUser && (
            <Link href="/login" className="hero-cta-secondary">
              <UserPlus size={15} /> Crear cuenta
            </Link>
          )}
        </motion.div>

        <div className="hero-trust">
          <div className="trust-item">
            <div className="trust-icon"><Truck size={16} /></div>
            <div className="trust-text">
              <strong>Envío express</strong>
              <span>Entrega en 24–48h</span>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon"><Shield size={16} /></div>
            <div className="trust-text">
              <strong>Garantía oficial</strong>
              <span>1 año de cobertura</span>
            </div>
          </div>
          <div className="trust-item">
            <div className="trust-icon"><Package size={16} /></div>
            <div className="trust-text">
              <strong>+200 productos</strong>
              <span>Stock permanente</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
