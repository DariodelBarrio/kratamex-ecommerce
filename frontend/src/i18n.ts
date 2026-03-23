type Lang = 'es' | 'en';

const translations: Record<Lang, Record<string, string>> = {
  es: {
    // Nav
    'nav.store': 'Tienda',
    'nav.cart': 'Carrito',
    'nav.login': 'Iniciar sesión',
    'nav.register': 'Registrarse',
    'nav.profile': 'Mi perfil',
    'nav.orders': 'Mis pedidos',
    'nav.favorites': 'Favoritos',
    'nav.logout': 'Cerrar sesión',
    'nav.admin': 'Admin',
    // Store
    'store.hero.title': 'Tecnología Premium',
    'store.hero.subtitle': 'Los mejores portátiles y equipos al mejor precio',
    'store.search': 'Buscar productos...',
    'store.all': 'Todos',
    'store.filter.price': 'Precio',
    'store.filter.min': 'Mín',
    'store.filter.max': 'Máx',
    'store.filter.inStock': 'En stock',
    'store.filter.featured': 'Destacados',
    'store.noResults': 'No se encontraron productos',
    'store.addToCart': 'Añadir al carrito',
    'store.outOfStock': 'Sin stock',
    'store.added': 'agregado al carrito',
    'store.stock': 'En stock',
    'store.units': 'unidades',
    'store.freeShipping': 'Envío gratis a partir de €100',
    // Cart
    'cart.title': 'Carrito de compra',
    'cart.empty': 'Tu carrito está vacío',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Envío',
    'cart.shippingFree': 'Gratis',
    'cart.tax': 'IVA (21%)',
    'cart.discount': 'Descuento',
    'cart.total': 'Total',
    'cart.coupon': 'Código de cupón',
    'cart.applyCoupon': 'Aplicar',
    'cart.checkout': 'Finalizar compra',
    'cart.name': 'Nombre completo',
    'cart.email': 'Email',
    'cart.address': 'Dirección de envío',
    'cart.processing': 'Procesando...',
    'cart.success': '¡Pedido realizado con éxito!',
    'cart.successMsg': 'Recibirás un email de confirmación.',
    'cart.continue': 'Seguir comprando',
    // Auth
    'auth.login': 'Iniciar sesión',
    'auth.register': 'Crear cuenta',
    'auth.username': 'Usuario',
    'auth.password': 'Contraseña', // NOSONAR — translation label, not a credential
    'auth.email': 'Email',
    'auth.name': 'Nombre completo',
    'auth.noAccount': '¿No tienes cuenta?',
    'auth.hasAccount': '¿Ya tienes cuenta?',
    'auth.registerHere': 'Regístrate aquí',
    'auth.loginHere': 'Inicia sesión',
    // Orders
    'orders.title': 'Mis pedidos',
    'orders.empty': 'No tienes pedidos aún',
    'orders.order': 'Pedido',
    'orders.status': 'Estado',
    'orders.date': 'Fecha',
    'orders.total': 'Total',
    'orders.items': 'artículos',
    // Profile
    'profile.title': 'Mi perfil',
    'profile.save': 'Guardar cambios',
    'profile.saved': 'Perfil actualizado',
    'profile.phone': 'Teléfono',
    'profile.address': 'Dirección',
    'profile.language': 'Idioma',
    // Ratings
    'rating.title': 'Valoraciones',
    'rating.write': 'Escribir valoración',
    'rating.titleField': 'Título',
    'rating.comment': 'Tu valoración',
    'rating.submit': 'Enviar valoración',
    'rating.noRatings': 'Sin valoraciones aún. ¡Sé el primero!',
    'rating.loginRequired': 'Inicia sesión para valorar',
    // Status
    'status.pendiente': 'Pendiente',
    'status.confirmado': 'Confirmado',
    'status.enviado': 'Enviado',
    'status.entregado': 'Entregado',
    'status.cancelado': 'Cancelado',
    // General
    'general.loading': 'Cargando...',
    'general.error': 'Error',
    'general.save': 'Guardar',
    'general.cancel': 'Cancelar',
    'general.delete': 'Eliminar',
    'general.edit': 'Editar',
    'general.close': 'Cerrar',
    'general.back': 'Volver',
  },
  en: {
    // Nav
    'nav.store': 'Store',
    'nav.cart': 'Cart',
    'nav.login': 'Sign in',
    'nav.register': 'Sign up',
    'nav.profile': 'My profile',
    'nav.orders': 'My orders',
    'nav.favorites': 'Favorites',
    'nav.logout': 'Sign out',
    'nav.admin': 'Admin',
    // Store
    'store.hero.title': 'Premium Technology',
    'store.hero.subtitle': 'The best laptops and equipment at the best price',
    'store.search': 'Search products...',
    'store.all': 'All',
    'store.filter.price': 'Price',
    'store.filter.min': 'Min',
    'store.filter.max': 'Max',
    'store.filter.inStock': 'In stock',
    'store.filter.featured': 'Featured',
    'store.noResults': 'No products found',
    'store.addToCart': 'Add to cart',
    'store.outOfStock': 'Out of stock',
    'store.added': 'added to cart',
    'store.stock': 'In stock',
    'store.units': 'units',
    'store.freeShipping': 'Free shipping from €100',
    // Cart
    'cart.title': 'Shopping cart',
    'cart.empty': 'Your cart is empty',
    'cart.subtotal': 'Subtotal',
    'cart.shipping': 'Shipping',
    'cart.shippingFree': 'Free',
    'cart.tax': 'Tax (21%)',
    'cart.discount': 'Discount',
    'cart.total': 'Total',
    'cart.coupon': 'Coupon code',
    'cart.applyCoupon': 'Apply',
    'cart.checkout': 'Place order',
    'cart.name': 'Full name',
    'cart.email': 'Email',
    'cart.address': 'Shipping address',
    'cart.processing': 'Processing...',
    'cart.success': 'Order placed successfully!',
    'cart.successMsg': 'You will receive a confirmation email.',
    'cart.continue': 'Continue shopping',
    // Auth
    'auth.login': 'Sign in',
    'auth.register': 'Create account',
    'auth.username': 'Username',
    'auth.password': 'Password', // NOSONAR — translation label, not a credential
    'auth.email': 'Email',
    'auth.name': 'Full name',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.registerHere': 'Sign up here',
    'auth.loginHere': 'Sign in',
    // Orders
    'orders.title': 'My orders',
    'orders.empty': "You don't have any orders yet",
    'orders.order': 'Order',
    'orders.status': 'Status',
    'orders.date': 'Date',
    'orders.total': 'Total',
    'orders.items': 'items',
    // Profile
    'profile.title': 'My profile',
    'profile.save': 'Save changes',
    'profile.saved': 'Profile updated',
    'profile.phone': 'Phone',
    'profile.address': 'Address',
    'profile.language': 'Language',
    // Ratings
    'rating.title': 'Reviews',
    'rating.write': 'Write a review',
    'rating.titleField': 'Title',
    'rating.comment': 'Your review',
    'rating.submit': 'Submit review',
    'rating.noRatings': 'No reviews yet. Be the first!',
    'rating.loginRequired': 'Sign in to leave a review',
    // Status
    'status.pendiente': 'Pending',
    'status.confirmado': 'Confirmed',
    'status.enviado': 'Shipped',
    'status.entregado': 'Delivered',
    'status.cancelado': 'Cancelled',
    // General
    'general.loading': 'Loading...',
    'general.error': 'Error',
    'general.save': 'Save',
    'general.cancel': 'Cancel',
    'general.delete': 'Delete',
    'general.edit': 'Edit',
    'general.close': 'Close',
    'general.back': 'Back',
  },
};

let currentLang: Lang = (localStorage.getItem('kratamex_lang') as Lang) || 'es';
const listeners = new Set<() => void>();

export function t(key: string): string {
  return translations[currentLang][key] || translations['es'][key] || key;
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang) {
  currentLang = lang;
  localStorage.setItem('kratamex_lang', lang);
  listeners.forEach(fn => fn());
}

export function onLangChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
