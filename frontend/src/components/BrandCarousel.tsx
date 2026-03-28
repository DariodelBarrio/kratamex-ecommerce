import { useRef, useCallback } from 'react'

const BRANDS = [
  { id: 'nvidia', name: 'NVIDIA', node: <svg viewBox="0 0 24 24" width="80" height="32"><path fill="#76B900" d="M12 2L2 8.5V20l10 2.5 10-2.5V8.5L12 2z"/></svg> },
  { id: 'amd', name: 'AMD', node: <svg viewBox="0 0 24 24" width="60" height="32"><path fill="#FF0000" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg> },
  { id: 'intel', name: 'Intel', node: <svg viewBox="0 0 24 24" width="50" height="32"><path fill="#0068B5" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg> },
  { id: 'asus', name: 'ASUS', node: <svg viewBox="0 0 24 24" width="70" height="32"><path fill="#003399" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg> },
  { id: 'msi', name: 'MSI', node: <svg viewBox="0 0 24 24" width="50" height="32"><path fill="#FF0000" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg> },
  { id: 'gigabyte', name: 'Gigabyte', node: <svg viewBox="0 0 24 24" width="70" height="32"><path fill="#FF6600" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg> },
  { id: 'corsair', name: 'Corsair', node: <svg viewBox="0 0 24 24" width="70" height="32"><path fill="#FFFFFF" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg> },
  { id: ' Kingston', name: 'Kingston', node: <svg viewBox="0 0 24 24" width="70" height="32"><path fill="#FFFFFF" d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg> },
]

const BRANDS_DOUBLED = [...BRANDS, ...BRANDS]

const FRICTION = 0.95

export function BrandCarousel() {
  const trackRef = useRef<HTMLDivElement>(null)
  const rafId = useRef<number | null>(null)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const velocity = useRef(0)

  const startDrag = useCallback((pageX: number) => {
    isDragging.current = true
    lastX.current = pageX
    velocity.current = 0
    if (rafId.current) cancelAnimationFrame(rafId.current)
  }, [])

  const stopDrag = useCallback(() => {
    isDragging.current = false
  }, [])

  const moveDrag = useCallback((pageX: number) => {
    if (!isDragging.current) return
    const dx = pageX - lastX.current
    if (trackRef.current) trackRef.current.scrollLeft -= dx
    velocity.current = dx
    lastX.current = pageX
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!trackRef.current) return
    if (e.key === 'ArrowLeft') trackRef.current.scrollLeft -= 200
    if (e.key === 'ArrowRight') trackRef.current.scrollLeft += 200
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => startDrag(e.pageX), [startDrag])
  const handleMouseMove = useCallback((e: React.MouseEvent) => moveDrag(e.pageX), [moveDrag])
  const handleTouchStart = useCallback((e: React.TouchEvent) => startDrag(e.touches[0].pageX), [startDrag])
  const handleTouchMove = useCallback((e: React.TouchEvent) => moveDrag(e.touches[0].pageX), [moveDrag])

  return (
    <section aria-label="Carrusel de marcas" className="bc-outer">
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
        onKeyDown={handleKeyDown}
      >
        {BRANDS_DOUBLED.map(brand => (
          <div key={brand.id} className="bc-item">
            {brand.node}
          </div>
        ))}
      </div>
      <div className="bc-fade-right" aria-hidden="true" />
    </section>
  )
}
