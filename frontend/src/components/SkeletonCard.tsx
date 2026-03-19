// =================================================================
// SKELETON CARD — Elegant loading placeholder
// =================================================================

export function SkeletonCard() {
  return (
    <div className="product-card glass-card skeleton-card">
      <div className="gradient-border" />
      <div className="skeleton-image">
        <div className="skeleton-shimmer" />
      </div>
      <div className="product-info">
        <div className="skeleton-line skeleton-category" />
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line skeleton-desc" />
        <div className="skeleton-line skeleton-desc-short" />
        <div className="skeleton-line skeleton-price" />
        <div className="skeleton-line skeleton-btn" />
      </div>
    </div>
  );
}
