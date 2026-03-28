// SSR-safe i18n — does not access localStorage at module level

type Lang = 'es' | 'en'

const translations: Record<Lang, Record<string, string>> = {
  es: {
    'nav.store': 'Tienda', 'nav.cart': 'Carrito', 'nav.login': 'Iniciar sesión',
    'nav.register': 'Registrarse', 'nav.profile': 'Mi perfil', 'nav.orders': 'Mis pedidos',
    'nav.favorites': 'Favoritos', 'nav.logout': 'Cerrar sesión', 'nav.admin': 'Admin',
    'store.addToCart': 'Añadir al carrito', 'store.outOfStock': 'Sin stock',
    'store.added': 'agregado al carrito',
    'cart.title': 'Carrito de compra', 'cart.empty': 'Tu carrito está vacío',
    'cart.subtotal': 'Subtotal', 'cart.shipping': 'Envío', 'cart.shippingFree': 'Gratis',
    'cart.tax': 'IVA (21%)', 'cart.discount': 'Descuento', 'cart.total': 'Total',
    'cart.checkout': 'Finalizar compra', 'cart.processing': 'Procesando...',
    'cart.success': '¡Pedido realizado con éxito!', 'cart.continue': 'Seguir comprando',
    'auth.login': 'Iniciar sesión', 'auth.register': 'Crear cuenta',
    'auth.username': 'Usuario', 'auth.password': 'Contraseña', // NOSONAR
    'auth.email': 'Email', 'auth.name': 'Nombre completo',
    'auth.noAccount': '¿No tienes cuenta?', 'auth.hasAccount': '¿Ya tienes cuenta?',
    'auth.registerHere': 'Regístrate aquí', 'auth.loginHere': 'Inicia sesión',
    'orders.title': 'Mis pedidos', 'orders.empty': 'No tienes pedidos aún',
    'orders.order': 'Pedido', 'orders.date': 'Fecha', 'orders.total': 'Total',
    'orders.items': 'artículos',
    'profile.title': 'Mi perfil', 'profile.save': 'Guardar cambios', 'profile.saved': 'Perfil actualizado',
    'profile.phone': 'Teléfono', 'profile.address': 'Dirección', 'profile.language': 'Idioma',
    'rating.title': 'Valoraciones', 'rating.write': 'Escribir valoración',
    'rating.noRatings': 'Sin valoraciones aún. ¡Sé el primero!',
    'rating.loginRequired': 'Inicia sesión para valorar',
    'status.pendiente': 'Pendiente', 'status.confirmado': 'Confirmado',
    'status.enviado': 'Enviado', 'status.entregado': 'Entregado', 'status.cancelado': 'Cancelado',
    'general.loading': 'Cargando...', 'general.error': 'Error',
    'general.save': 'Guardar', 'general.cancel': 'Cancelar', 'general.back': 'Volver',
  },
  en: {
    'nav.store': 'Store', 'nav.cart': 'Cart', 'nav.login': 'Sign in',
    'nav.register': 'Sign up', 'nav.profile': 'My profile', 'nav.orders': 'My orders',
    'nav.favorites': 'Favorites', 'nav.logout': 'Sign out', 'nav.admin': 'Admin',
    'store.addToCart': 'Add to cart', 'store.outOfStock': 'Out of stock',
    'store.added': 'added to cart',
    'cart.title': 'Shopping cart', 'cart.empty': 'Your cart is empty',
    'cart.subtotal': 'Subtotal', 'cart.shipping': 'Shipping', 'cart.shippingFree': 'Free',
    'cart.tax': 'Tax (21%)', 'cart.discount': 'Discount', 'cart.total': 'Total',
    'cart.checkout': 'Place order', 'cart.processing': 'Processing...',
    'cart.success': 'Order placed successfully!', 'cart.continue': 'Continue shopping',
    'auth.login': 'Sign in', 'auth.register': 'Create account',
    'auth.username': 'Username', 'auth.password': 'Password', // NOSONAR
    'auth.email': 'Email', 'auth.name': 'Full name',
    'auth.noAccount': "Don't have an account?", 'auth.hasAccount': 'Already have an account?',
    'auth.registerHere': 'Sign up here', 'auth.loginHere': 'Sign in',
    'orders.title': 'My orders', 'orders.empty': "You don't have any orders yet",
    'orders.order': 'Order', 'orders.date': 'Date', 'orders.total': 'Total',
    'orders.items': 'items',
    'profile.title': 'My profile', 'profile.save': 'Save changes', 'profile.saved': 'Profile updated',
    'profile.phone': 'Phone', 'profile.address': 'Address', 'profile.language': 'Language',
    'rating.title': 'Reviews', 'rating.write': 'Write a review',
    'rating.noRatings': 'No reviews yet. Be the first!',
    'rating.loginRequired': 'Sign in to leave a review',
    'status.pendiente': 'Pending', 'status.confirmado': 'Confirmed',
    'status.enviado': 'Shipped', 'status.entregado': 'Delivered', 'status.cancelado': 'Cancelled',
    'general.loading': 'Loading...', 'general.error': 'Error',
    'general.save': 'Save', 'general.cancel': 'Cancel', 'general.back': 'Back',
  },
}

function getLang(): Lang {
  if (typeof window === 'undefined') return 'es'
  return (localStorage.getItem('kratamex_lang') as Lang) || 'es'
}

export function t(key: string): string {
  const lang = getLang()
  return translations[lang][key] ?? translations['es'][key] ?? key
}
