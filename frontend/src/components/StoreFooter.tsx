export function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="container footer-grid">
        <div className="footer-col">
          <h4 className="footer-col-title">Por qué comprar</h4>
          <ul className="footer-col-list">
            <li><button type="button" className="footer-link">Cómo comprar</button></li>
            <li><button type="button" className="footer-link">Formas de pago</button></li>
            <li><button type="button" className="footer-link">Gastos de envío</button></li>
            <li><button type="button" className="footer-link">Cupones descuento</button></li>
            <li><button type="button" className="footer-link">Preguntas frecuentes</button></li>
            <li><button type="button" className="footer-link">Opiniones de clientes</button></li>
            <li><button type="button" className="footer-link">Garantía y devoluciones</button></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Empresa</h4>
          <ul className="footer-col-list">
            <li><button type="button" className="footer-link">Quiénes somos</button></li>
            <li><button type="button" className="footer-link">Compromisos</button></li>
            <li><button type="button" className="footer-link">Nuestras marcas</button></li>
            <li><button type="button" className="footer-link">Afiliados</button></li>
            <li><button type="button" className="footer-link">Aviso legal</button></li>
            <li><button type="button" className="footer-link">Privacidad</button></li>
            <li><button type="button" className="footer-link">Condiciones de compra</button></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Ayuda</h4>
          <ul className="footer-col-list">
            <li><button type="button" className="footer-link">Contacto y ayuda</button></li>
            <li><button type="button" className="footer-link">Devoluciones</button></li>
            <li><button type="button" className="footer-link">Seguimiento de pedidos</button></li>
            <li><button type="button" className="footer-link">Trabaja con nosotros</button></li>
            <li><button type="button" className="footer-link">Canal ético</button></li>
            <li><button type="button" className="footer-link">Política de cookies</button></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-col-title">Comunidad</h4>
          <ul className="footer-col-list">
            <li><button type="button" className="footer-link">Blog</button></li>
            <li><button type="button" className="footer-link">Instagram</button></li>
            <li><button type="button" className="footer-link">Twitter / X</button></li>
            <li><button type="button" className="footer-link">Facebook</button></li>
            <li><button type="button" className="footer-link">YouTube</button></li>
            <li><button type="button" className="footer-link">TikTok</button></li>
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
