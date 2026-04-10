import { useRef, useCallback } from 'react'

function HPLogo() {
  return (
    <img
      src={`data:image/svg+xml;utf8,<svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="20" stroke="#0096D6" strokeWidth="2.2" fill="none" /><text x="22" y="27" textAnchor="middle" fill="#0096D6" fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif">hp</text></svg>`}
      alt="HP"
      width="44"
      height="44"
    />
  )
}

function IntelLogo() {
  return (
    <img
      src={`data:image/svg+xml;utf8,<svg width="100" height="30" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg"><text x="50" y="20" textAnchor="middle" fill="#0068B5" fontSize="16" fontWeight="300" fontFamily="Georgia, serif" fontStyle="italic">intel</text><text x="70" y="20" textAnchor="middle" fill="#0068B5" fontSize="18" fontWeight="900" fontFamily="Georgia, serif">.</text></svg>`}
      alt="Intel"
      width="100"
      height="30"
    />
  )
}

function NvidiaLogo() {
  return (
    <img
      src={`data:image/svg+xml;utf8,<svg width="100" height="30" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg"><polygon points="0,18 18,0 18,18" fill="#76B900" transform="translate(10, 5)" /><text x="50" y="25" textAnchor="middle" fill="#76B900" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">NVIDIA</text></svg>`}
      alt="Nvidia"
      width="100"
      height="30"
    />
  )
}

function AmdLogo() {
  return (
    <img
      src={`data:image/svg+xml;utf8,<svg width="100" height="30" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="5" width="14" height="14" rx="2" fill="none" stroke="#ED1C24" strokeWidth="2" /><line x1="10" y1="18" x2="24" y2="4" stroke="#ED1C24" strokeWidth="2" /><text x="50" y="25" textAnchor="middle" fill="#ED1C24" fontSize="18" fontWeight="900" fontFamily="Arial, sans-serif">AMD</text></svg>`}
      alt="AMD"
      width="100"
      height="30"
    />
  )
}

interface Brand { id: string; node: React.ReactNode }

const BRANDS: Brand[] = [
  { id: 'hp',       node: <HPLogo /> },
  { id: 'samsung',  node: <span className="bc-text" style={{ color: '#1428A0', fontWeight: 700, letterSpacing: '-0.03em', fontSize: '1.15rem' }}>SAMSUNG</span> },
  { id: 'apple',    node: <span className="bc-text" style={{ color: '#aaaaaa', fontWeight: 300, fontSize: '1.35rem', fontFamily: 'Georgia, serif' }}>Apple</span> },
  { id: 'intel',    node: <IntelLogo /> },
  { id: 'amd',      node: <AmdLogo /> },
  { id: 'nvidia',   node: <NvidiaLogo /> },
  { id: 'corsair',  node: <span className="bc-text" style={{ color: '#7a7a7a', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.12em' }}>CORSAIR</span> },
  { id: 'asus',     node: <span className="bc-text" style={{ color: '#00539B', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '0.06em' }}>ASUS</span> },
  { id: 'msi',      node: <span className="bc-text" style={{ color: '#CC0000', fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.04em' }}>MSI</span> },
  { id: 'lenovo',   node: <span className="bc-text" style={{ color: '#E2231A', fontWeight: 400, fontSize: '1.2rem' }}>Lenovo</span> },
  { id: 'dell',     node: <span className="bc-text" style={{ color: '#007DB8', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '0.06em' }}>DELL</span> },
  { id: 'logitech', node: <span className="bc-text" style={{ color: '#888888', fontWeight: 400, fontSize: '1rem' }}>Logitech</span> },
]

const BRANDS_QUAD = [
  ...BRANDS,
  ...BRANDS.map(b => ({ ...b, id: b.id + '_2' })),
  ...BRANDS.map(b => ({ ...b, id: b.id + '_3' })),
  ...BRANDS.map(b => ({ ...b, id: b.id + '_4' })),
]

// Duración en segundos para un ciclo completo (1 copia)
const DURATION = 30

export function BrandCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const dragX = useRef(0)

  const startDrag = useCallback((pageX: number) => {
    const el = trackRef.current
    if (!el) return
    // Capturar posición actual de la animación CSS
    const matrix = new DOMMatrix(globalThis.getComputedStyle(el).transform)
    dragX.current = matrix.m41
    // Congelar animación en esa posición
    el.style.animation = 'none'
    el.style.transform = `translateX(${dragX.current}px)`
    isDragging.current = true
    lastX.current = pageX
  }, [])

  const moveDrag = useCallback((pageX: number) => {
    if (!isDragging.current) return
    const el = trackRef.current
    if (!el) return
    dragX.current += pageX - lastX.current
    lastX.current = pageX
    // Normalizar para bucle infinito en ambas direcciones
    const single = el.scrollWidth / 4
    if (dragX.current > 0) dragX.current -= single
    if (dragX.current <= -single) dragX.current += single
    el.style.transform = `translateX(${dragX.current}px)`
  }, [])

  const stopDrag = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    const el = trackRef.current
    if (!el) return
    // Reanudar animación CSS desde la posición del drag
    const single = el.scrollWidth / 4
    const progress = -dragX.current / single          // 0..1
    const delay = -(progress * DURATION)               // delay negativo = arrancar mid-ciclo
    el.style.transform = ''
    el.style.animation = `bc-scroll ${DURATION}s ${delay}s linear infinite`
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => startDrag(e.pageX), [startDrag])
  const handleMouseMove = useCallback((e: React.MouseEvent) => moveDrag(e.pageX), [moveDrag])
  const handleTouchStart = useCallback((e: React.TouchEvent) => startDrag(e.touches[0].pageX), [startDrag])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    moveDrag(e.touches[0].pageX)
  }, [moveDrag])

  return (
    <div className="bc-outer" aria-label="Carrusel de marcas">
      <div className="bc-fade-left" aria-hidden="true" />
      <div
        className="bc-track"
        ref={trackRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={stopDrag}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ') {
            stopDrag();
          }
        }}
        role="region"
      >
        {BRANDS_QUAD.map(brand => (
          <div key={brand.id} className="bc-item">
            {brand.node}
          </div>
        ))}
      </div>
      <div className="bc-fade-right" aria-hidden="true" />
    </div>
  )
}