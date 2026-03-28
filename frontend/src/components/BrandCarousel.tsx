import { useRef, useCallback, useEffect } from 'react'

// ── SVG logos inline ─────────────────────────────────────────────
function HPLogo() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" aria-label="HP">
      <circle cx="22" cy="22" r="20" stroke="#0096D6" strokeWidth="2.2" fill="none" />
      <text x="22" y="27" textAnchor="middle" fill="#0096D6"
        fontSize="16" fontWeight="900" fontFamily="Arial, sans-serif">hp</text>
    </svg>
  )
}

function IntelLogo() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <span style={{ color: '#0068B5', fontWeight: 300, fontSize: '1.45rem', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
        intel
      </span>
      <span style={{ color: '#0068B5', fontWeight: 900, fontSize: '1.6rem', lineHeight: 1 }}>.</span>
    </span>
  )
}

function NvidiaLogo() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <polygon points="0,18 18,0 18,18" fill="#76B900" />
      </svg>
      <span style={{ color: '#76B900', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em' }}>NVIDIA</span>
    </span>
  )
}

function AmdLogo() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect x="4" y="4" width="14" height="14" rx="2" fill="none" stroke="#ED1C24" strokeWidth="2" />
        <line x1="4" y1="18" x2="18" y2="4" stroke="#ED1C24" strokeWidth="2" />
      </svg>
      <span style={{ color: '#ED1C24', fontWeight: 900, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>AMD</span>
    </span>
  )
}

// ── Brand list ────────────────────────────────────────────────────
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

// Duplicate for visual density when dragging far right
const BRANDS_DOUBLED = [...BRANDS, ...BRANDS.map(b => ({ ...b, id: b.id + '_2' }))]

const AUTO_SPEED  = 0.8  // px por frame en auto-scroll
const FRICTION    = 0.92
const MIN_VELOCITY = 0.4

// ── Component ─────────────────────────────────────────────────────
export function BrandCarousel() {
  const trackRef    = useRef<HTMLDivElement>(null)
  const isDragging  = useRef(false)
  const startX      = useRef(0)
  const scrollLeft  = useRef(0)
  const lastX       = useRef(0)
  const lastT       = useRef(0)
  const velocity    = useRef(0)
  const rafId       = useRef<number>(0)
  const autoRafId   = useRef<number>(0)

  // ── Auto-scroll infinito ──────────────────────────────────────
  useEffect(() => {
    const el = trackRef.current
    if (!el) return

    const tick = () => {
      if (!isDragging.current) {
        el.scrollLeft += AUTO_SPEED
        // Al llegar a la mitad (items duplicados) vuelve al inicio sin salto
        if (el.scrollLeft >= el.scrollWidth / 2) {
          el.scrollLeft -= el.scrollWidth / 2
        }
      }
      autoRafId.current = requestAnimationFrame(tick)
    }
    autoRafId.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(autoRafId.current)
  }, [])

  const cancelMomentum = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current)
  }

  const startDrag = useCallback((pageX: number) => {
    cancelMomentum()
    const el = trackRef.current
    if (!el) return
    isDragging.current   = true
    startX.current       = pageX - el.offsetLeft
    scrollLeft.current   = el.scrollLeft
    lastX.current        = pageX
    lastT.current        = performance.now()
    velocity.current     = 0
    el.style.cursor      = 'grabbing'
  }, [])

  const moveDrag = useCallback((pageX: number) => {
    if (!isDragging.current) return
    const el = trackRef.current
    if (!el) return
    const x = pageX - el.offsetLeft
    el.scrollLeft = scrollLeft.current - (x - startX.current) * 1.4

    const now = performance.now()
    const dt  = now - lastT.current
    if (dt > 0) velocity.current = (lastX.current - pageX) / dt
    lastX.current = pageX
    lastT.current = now
  }, [])

  const stopDrag = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false
    if (trackRef.current) trackRef.current.style.cursor = 'grab'

    let v = velocity.current * 16

    const animate = () => {
      const el = trackRef.current
      if (!el || Math.abs(v) < MIN_VELOCITY) return
      el.scrollLeft += v
      if (el.scrollLeft >= el.scrollWidth / 2) el.scrollLeft -= el.scrollWidth / 2
      if (el.scrollLeft < 0) el.scrollLeft += el.scrollWidth / 2
      v *= FRICTION
      rafId.current = requestAnimationFrame(animate)
    }
    rafId.current = requestAnimationFrame(animate)
  }, [])

  return (
    <div className="bc-outer">
      <div className="bc-fade-left" aria-hidden="true" />
      <div
        className="bc-track"
        ref={trackRef}
        role="region"
        aria-label="Carrusel de marcas"
        tabIndex={0}
        onMouseDown={e => startDrag(e.pageX)}
        onMouseMove={e => moveDrag(e.pageX)}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchStart={e => startDrag(e.touches[0].pageX)}
        onTouchMove={e => moveDrag(e.touches[0].pageX)}
        onTouchEnd={stopDrag}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') trackRef.current!.scrollLeft -= 200;
          if (e.key === 'ArrowRight') trackRef.current!.scrollLeft += 200;
        }}
      >
        {BRANDS_DOUBLED.map(brand => (
          <div key={brand.id} className="bc-item">
            {brand.node}
          </div>
        ))}
      </div>
      <div className="bc-fade-right" aria-hidden="true" />
    </div>
  )
}
