import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Check, Monitor } from 'lucide-react';
import { Producto } from '../interfaces';

// =================================================================
// PRODUCT CARD
// =================================================================
interface ProductCardProps {
  producto: Producto;
  onAddToCart: (producto: Producto) => void;
  index: number;
}

export function ProductCard({ producto, onAddToCart, index }: ProductCardProps) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (added) return;
    onAddToCart(producto);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <motion.div
      className="product-card glass-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -6 }}
      layout
    >
      <div className="gradient-border" />

      {/* Product Image */}
      <div className="product-image-area">
        {producto.imagen ? (
          <img
            src={producto.imagen}
            alt={producto.nombre}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              borderRadius: '8px',
            }}
            loading="lazy"
          />
        ) : (
          <Monitor size={48} stroke="#475569" />
        )}
      </div>

      {/* Product Info */}
      <div className="product-info">
        <div className="product-category">{producto.categoria}</div>
        <h3 className="product-name">{producto.nombre}</h3>
        <p className="product-description">{producto.descripcion}</p>

        <div className="product-price-row">
          <motion.span
            className="product-price"
            whileHover={{ textShadow: '0 0 20px rgba(52, 211, 153, 0.6)' }}
          >
            ${producto.precio.toFixed(2)}
          </motion.span>
        </div>

        <motion.button
          className={`add-to-cart ${added ? 'add-to-cart--success' : ''}`}
          onClick={handleAdd}
          whileTap={{ scale: 0.96 }}
        >
          <AnimatePresence mode="wait">
            {added ? (
              <motion.span
                key="added"
                className="add-to-cart-content"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Check size={16} /> Agregado
              </motion.span>
            ) : (
              <motion.span
                key="add"
                className="add-to-cart-content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ShoppingCart size={16} /> Agregar al Carrito
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  );
}

// =================================================================
// SMALL BRAND LOGO (cart items)
// =================================================================
export function BrandLogoSmall({ imagen, nombre }: { imagen?: string; nombre?: string }) {
  return (
    <div className="brand-logo-sm">
      {imagen ? (
        <img
          src={imagen}
          alt={nombre || 'Producto'}
          style={{ width: 32, height: 23, objectFit: 'cover', borderRadius: 4 }}
        />
      ) : (
        <Monitor size={20} stroke="#475569" />
      )}
    </div>
  );
}
