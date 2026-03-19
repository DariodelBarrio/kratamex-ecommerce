import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Check, Monitor, Heart } from 'lucide-react';
import type { Producto } from '../interfaces';

// =================================================================
// PRODUCT CARD
// =================================================================
interface ProductCardProps {
  producto: Producto;
  onAddToCart: (producto: Producto) => void;
  index: number;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: number) => void;
  vistaLista?: boolean;
}

export function ProductCard({ producto, onAddToCart, index, isWishlisted = false, onToggleWishlist, vistaLista = false }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const navigate = useNavigate();

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (added) return;
    onAddToCart(producto);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  if (vistaLista) {
    return (
      <motion.div
        className="product-card-list"
        onClick={() => navigate(`/producto/${producto.id}`)}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: 'easeOut' }}
        layout
      >
        <div className="product-list-image">
          {producto.imagen ? (
            <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
          ) : (
            <div className="product-image-placeholder">
              <Monitor size={32} stroke="#475569" />
            </div>
          )}
        </div>

        <div className="product-list-body">
          <div className="product-list-top">
            {producto.categoria && (
              <span className="product-list-category">{producto.categoria}</span>
            )}
            <h3 className="product-list-name">{producto.nombre}</h3>
            {producto.descripcion && (
              <p className="product-list-desc">{producto.descripcion}</p>
            )}
          </div>

          <div className="product-list-footer">
            <span className="product-price">${producto.precio.toFixed(2)}</span>

            <div className="product-list-actions">
              {onToggleWishlist && (
                <motion.button
                  className={`wishlist-btn wishlist-btn--visible ${isWishlisted ? 'wishlist-btn--active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleWishlist(producto.id); }}
                  title={isWishlisted ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  whileTap={{ scale: 0.85 }}
                >
                  <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
                </motion.button>
              )}

              <motion.button
                className={`add-to-cart ${added ? 'add-to-cart--success' : ''}`}
                style={{ width: 'auto', padding: '9px 18px' }}
                onClick={handleAdd}
                title="Agregar al carrito"
                whileTap={{ scale: 0.97 }}
              >
                <AnimatePresence mode="wait">
                  {added ? (
                    <motion.span
                      key="added"
                      className="add-to-cart-content"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <Check size={15} /> Agregado
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
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="product-card"
      onClick={() => navigate(`/producto/${producto.id}`)}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4), ease: 'easeOut' }}
      whileHover={{ y: -5 }}
      layout
    >
      {/* Image */}
      <div className="product-image-area">
        {producto.categoria && (
          <div className="product-category-pill">{producto.categoria}</div>
        )}
        {onToggleWishlist && (
          <motion.button
            className={`wishlist-btn ${isWishlisted ? 'wishlist-btn--active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleWishlist(producto.id); }}
            title={isWishlisted ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            whileTap={{ scale: 0.85 }}
          >
            <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
          </motion.button>
        )}
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
        ) : (
          <div className="product-image-placeholder">
            <Monitor size={48} stroke="#475569" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="product-info">
        <h3 className="product-name">{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="product-description">{producto.descripcion}</p>
        )}

        <div className="product-card-footer">
          <span className="product-price">${producto.precio.toFixed(2)}</span>

          <motion.button
            className={`add-to-cart ${added ? 'add-to-cart--success' : ''}`}
            onClick={handleAdd}
            title="Agregar al carrito"
            whileTap={{ scale: 0.97 }}
          >
            <AnimatePresence mode="wait">
              {added ? (
                <motion.span
                  key="added"
                  className="add-to-cart-content"
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  <Check size={15} /> Agregado
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
                  <ShoppingCart size={15} /> Agregar al carrito
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
// BRAND LOGO SMALL (cart)
// =================================================================
export function BrandLogoSmall({ imagen, nombre }: { imagen?: string; nombre?: string }) {
  return (
    <div className="brand-logo-sm">
      {imagen ? (
        <img
          src={imagen}
          alt={nombre || 'Producto'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Monitor size={20} stroke="#475569" />
      )}
    </div>
  );
}
