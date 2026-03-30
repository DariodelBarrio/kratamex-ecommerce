'use client'

/**
 * ProductSkeleton — réplica de la estructura exacta de ProductCard
 * usada durante los estados de carga del catálogo.
 */
export function ProductSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Imagen */}
      <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' }}
        />
        {/* Shimmer */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
            animation: 'skeleton-sweep 1.6s ease-in-out infinite',
          }}
        />
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Category pill */}
        <div
          className="h-4 rounded-full w-1/4"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        />
        {/* Title */}
        <div
          className="h-5 rounded-full w-4/5"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        />
        {/* Description line 1 */}
        <div
          className="h-3 rounded-full w-full"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
        {/* Description line 2 */}
        <div
          className="h-3 rounded-full w-3/4"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
        {/* Footer row */}
        <div className="flex items-center justify-between pt-2">
          {/* Price */}
          <div
            className="h-7 rounded-full w-1/3"
            style={{ background: 'rgba(5,150,105,0.15)' }}
          />
          {/* Button */}
          <div
            className="h-9 rounded-xl w-2/5"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes skeleton-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  )
}
