import { Shield } from 'lucide-react';

// =================================================================
// SECURITY BADGE — Visual security indicator for header
// =================================================================
export function SecurityBadge() {
  return (
    <div className="security-badge" title="Conexión cifrada con TLS 1.3">
      <Shield size={12} />
      <span>Secure</span>
      <span className="security-dot" />
    </div>
  );
}
