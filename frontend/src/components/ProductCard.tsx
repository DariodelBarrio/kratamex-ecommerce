import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Check, Cpu } from 'lucide-react';
import { Producto } from '../interfaces';

// =================================================================
// BRAND DETECTION & CONFIG
// =================================================================
const BRAND_CONFIG: Record<string, { color: string; label: string }> = {
  apple:   { color: '#e8e8ed', label: 'apple' },
  dell:    { color: '#007db8', label: 'DELL' },
  hp:      { color: '#0096d6', label: 'hp' },
  lenovo:  { color: '#e2231a', label: 'Lenovo' },
  asus:    { color: '#00aaff', label: 'ASUS' },
  default: { color: '#475569', label: '' },
};

function detectBrand(name: string): string {
  const l = name.toLowerCase();
  if (l.includes('macbook') || l.includes('imac') || l.includes('apple') || l.includes('mac mini') || l.includes('mac pro')) return 'apple';
  if (l.includes('dell') || l.includes('xps') || l.includes('inspiron') || l.includes('latitude')) return 'dell';
  if (l.startsWith('hp ') || l.includes(' hp ') || l.includes('elitebook') || l.includes('spectre') || l.includes('pavilion') || l.includes('envy')) return 'hp';
  if (l.includes('lenovo') || l.includes('thinkpad') || l.includes('ideapad') || l.includes('yoga') || l.includes('legion')) return 'lenovo';
  if (l.includes('asus') || l.includes('rog') || l.includes('zenbook') || l.includes('vivobook') || l.includes('zephyrus')) return 'asus';
  return 'default';
}

// =================================================================
// PRODUCT CARD COMPONENT
// =================================================================
interface ProductCardProps {
  producto: Producto;
  featured?: boolean;
  onAddToCart: (producto: Producto) => void;
  index: number;
}

export function ProductCard({ producto, featured = false, onAddToCart, index }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const brand = detectBrand(producto.nombre);
  const { color, label } = BRAND_CONFIG[brand] ?? BRAND_CONFIG['default'];

  const handleAdd = () => {
    if (added) return;
    onAddToCart(producto);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <motion.div
      className={`product-card glass-card ${featured ? 'product-card--featured' : ''}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      whileHover={{ y: -8 }}
      layout
    >
      <div className="gradient-border" />

      {/* Brand Logo Area */}
      <div className={`product-image-area ${featured ? 'product-image-area--featured' : ''}`}>
        <div className="brand-logo-container">
          {brand !== 'default' ? (
            <svg
              viewBox="0 0 220 56"
              xmlns="http://www.w3.org/2000/svg"
              style={{ width: featured ? 140 : 100, height: featured ? 36 : 26 }}
              aria-label={label}
            >
              <text
                x="110" y="42" textAnchor="middle" fill={color}
                fontFamily="'Inter', system-ui, sans-serif"
                fontSize={featured ? 42 : 36} fontWeight="700"
                letterSpacing={brand === 'apple' ? -1 : 3}
              >
                {label}
              </text>
            </svg>
          ) : (
            <Cpu size={featured ? 48 : 36} style={{ color: '#475569' }} />
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="product-info">
        <div className="product-category">{producto.categoria}</div>
        <h3 className="product-name">{producto.nombre}</h3>
        <p className="product-description">{producto.descripcion}</p>

        <div className="product-price-row">
          <motion.span
            className="product-price"
            whileHover={{ textShadow: '0 0 16px rgba(52, 211, 153, 0.5)' }}
          >
            ${producto.precio.toFixed(2)}
          </motion.span>
        </div>

        <motion.button
          className={`add-to-cart ${added ? 'add-to-cart--success' : ''}`}
          onClick={handleAdd}
          whileTap={{ scale: 0.95 }}
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
// SMALL BRAND LOGO (for cart items)
// =================================================================
export function BrandLogoSmall({ name }: { name: string }) {
  const brand = detectBrand(name);
  const { color, label } = BRAND_CONFIG[brand] ?? BRAND_CONFIG['default'];

  return (
    <div className="brand-logo-sm">
      {brand !== 'default' ? (
        <svg
          viewBox="0 0 220 56"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: 36, height: 14 }}
          aria-label={label}
        >
          <text
            x="110" y="42" textAnchor="middle" fill={color}
            fontFamily="'Inter', system-ui, sans-serif"
            fontSize="28" fontWeight="700"
            letterSpacing={brand === 'apple' ? -1 : 2}
          >
            {label}
          </text>
        </svg>
      ) : (
        <Cpu size={18} style={{ color: '#475569' }} />
      )}
    </div>
  );
}
