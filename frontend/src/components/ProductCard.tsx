import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Check } from 'lucide-react';
import { Producto } from '../interfaces';

// =================================================================
// LAPTOP BLUEPRINT SVG — Technical outline drawing
// =================================================================
function LaptopBlueprint({ size = 80 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size * 0.714 }}
      aria-label="Laptop"
    >
      {/* Screen lid */}
      <rect x="25" y="8" width="90" height="55" rx="4" stroke="#475569" strokeWidth="1.2" />
      {/* Screen display */}
      <rect x="30" y="13" width="80" height="45" rx="2" stroke="#334155" strokeWidth="0.8" />
      {/* Camera dot */}
      <circle cx="70" cy="10" r="1" fill="#334155" />
      {/* Hinge line */}
      <line x1="18" y1="63" x2="122" y2="63" stroke="#475569" strokeWidth="1.2" />
      {/* Base / keyboard body */}
      <path
        d="M18 63 L14 78 Q13 81 16 81 L124 81 Q127 81 126 78 L122 63"
        stroke="#475569"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Keyboard rows */}
      <line x1="28" y1="68" x2="112" y2="68" stroke="#1e293b" strokeWidth="0.5" />
      <line x1="26" y1="72" x2="114" y2="72" stroke="#1e293b" strokeWidth="0.5" />
      {/* Trackpad */}
      <rect x="53" y="74" width="34" height="4" rx="1" stroke="#334155" strokeWidth="0.6" />
    </svg>
  );
}

function LaptopBlueprintSmall() {
  return (
    <svg
      viewBox="0 0 140 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: 32, height: 23 }}
      aria-label="Laptop"
    >
      <rect x="25" y="8" width="90" height="55" rx="4" stroke="#475569" strokeWidth="2" />
      <rect x="30" y="13" width="80" height="45" rx="2" stroke="#334155" strokeWidth="1.2" />
      <line x1="18" y1="63" x2="122" y2="63" stroke="#475569" strokeWidth="2" />
      <path
        d="M18 63 L14 78 Q13 81 16 81 L124 81 Q127 81 126 78 L122 63"
        stroke="#475569" strokeWidth="2" strokeLinejoin="round"
      />
    </svg>
  );
}

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

      {/* Blueprint Image Area */}
      <div className="product-image-area">
        <LaptopBlueprint size={76} />
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
export function BrandLogoSmall() {
  return (
    <div className="brand-logo-sm">
      <LaptopBlueprintSmall />
    </div>
  );
}
