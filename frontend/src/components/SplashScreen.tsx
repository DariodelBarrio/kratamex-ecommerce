import { useEffect } from 'react'
import { motion } from 'framer-motion'

export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="splash"
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <motion.div
        className="splash-content"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <motion.span
          className="splash-logo"
          initial={{ backgroundSize: '0% 100%' }}
          animate={{ backgroundSize: '100% 100%' }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          Kratamex
        </motion.span>

        <motion.p
          className="splash-sub"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          Tecnología de primer nivel
        </motion.p>

        {/* Barra de carga */}
        <div className="splash-bar-track">
          <motion.div
            className="splash-bar-fill"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.6, delay: 0.2, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>

      {/* Glow de fondo */}
      <div className="splash-glow" />
    </motion.div>
  )
}
