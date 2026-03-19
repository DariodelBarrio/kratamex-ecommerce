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
      className="product-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      layout
    >
      {/* Product Image */}
      <div className="product-image-area">
        {producto.categoria && (
          <div className="product-category-pill">{producto.categoria}</div>
        )}
        {producto.imagen ? (
          <img
            src={producto.imagen}
            alt={producto.nombre}
            loading="lazy"
          />
        ) : (
          <div className="product-image-placeholder">
            <Monitor size={44} stroke="#475569" />
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="product-info">
        <h3 className="product-name">{producto.nombre}</h3>
        <p className="product-description">{producto.descripcion}</p>

        <div className="product-footer">
          <span className="product-price">${producto.precio.toFixed(2)}</span>

          <motion.button
            className={`add-to-cart ${added ? 'add-to-cart--success' : ''}`}
            onClick={handleAdd}
            whileTap={{ scale: 0.94 }}
          >
            <AnimatePresence mode="wait">
              {added ? (
                <motion.span
                  key="added"
                  className="add-to-cart-content"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Check size={15} /> OK
                </motion.span>
              ) : (
                <motion.span
                  key="add"
                  className="add-to-cart-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  <ShoppingCart size={15} /> Agregar
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
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
