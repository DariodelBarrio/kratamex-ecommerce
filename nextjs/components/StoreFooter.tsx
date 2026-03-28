export function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="container footer-grid">
        <div className="footer-col">
          <h4 className="footer-col-title">Por qué comprar</h4>
          <ul className="footer-col-list">
            <li><a href="#" className="footer-link">Cómo comprar</a></li>
            <li><a href="#" className="footer-link">Formas de pago</a></li>
            <li><a href="#" className="footer-link">Gastos de envío</a></li>
            <li><a href="#" className="footer-link">Cupones descuento</a></li>
            <li><a href="#" className="footer-link">Preguntas frecuentes</a></li>
            <li><a href="#" className="footer-link">Opiniones de clientes</a></li>
            <li><a href="#" className="footer-link">Garantía y devoluciones</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Empresa</h4>
          <ul className="footer-col-list">
            <li><a href="#" className="footer-link">Quiénes somos</a></li>
            <li><a href="#" className="footer-link">Compromisos</a></li>
            <li><a href="#" className="footer-link">Nuestras marcas</a></li>
            <li><a href="#" className="footer-link">Afiliados</a></li>
            <li><a href="#" className="footer-link">Aviso legal</a></li>
            <li><a href="#" className="footer-link">Privacidad</a></li>
            <li><a href="#" className="footer-link">Condiciones de compra</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Ayuda</h4>
          <ul className="footer-col-list">
            <li><a href="#" className="footer-link">Contacto y ayuda</a></li>
            <li><a href="#" className="footer-link">Devoluciones</a></li>
            <li><a href="#" className="footer-link">Seguimiento de pedidos</a></li>
            <li><a href="#" className="footer-link">Trabaja con nosotros</a></li>
            <li><a href="#" className="footer-link">Canal ético</a></li>
            <li><a href="#" className="footer-link">Política de cookies</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Comunidad</h4>
          <ul className="footer-col-list">
            <li><a href="#" className="footer-link">Blog</a></li>
            <li><a href="#" className="footer-link">Instagram</a></li>
            <li><a href="#" className="footer-link">Twitter / X</a></li>
            <li><a href="#" className="footer-link">Facebook</a></li>
            <li><a href="#" className="footer-link">YouTube</a></li>
            <li><a href="#" className="footer-link">TikTok</a></li>
          </ul>
        </div>

        <div className="footer-col footer-col-payments">
          <h4 className="footer-col-title">Métodos de pago</h4>
          <div className="footer-payment-icons">
            <span className="payment-badge">VISA</span>
            <span className="payment-badge">Mastercard</span>
            <span className="payment-badge">PayPal</span>
            <span className="payment-badge">Google Pay</span>
            <span className="payment-badge">Apple Pay</span>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <span className="footer-brand">Kratamex</span>
          <span className="footer-copy">© {new Date().getFullYear()} Kratamex · Todos los derechos reservados</span>
        </div>
      </div>
    </footer>
  )
}
