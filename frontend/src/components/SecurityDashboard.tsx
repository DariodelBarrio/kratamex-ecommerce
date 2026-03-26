import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, Users, Wifi, Lock, RefreshCw, LogOut, Terminal, Eye, EyeOff, Globe, Search, Download, Ban, Trash2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './SecurityDashboard.module.css';

// ================================================================
// TYPES
// ================================================================
interface SecEvent {
  id: number;
  tipo: string;
  ip: string | null;
  username: string | null;
  endpoint: string | null;
  metodo: string | null;
  detalles: string | null;
  fecha: string;
}

interface VtResult {
  ip: string;
  malicious:  number;
  suspicious: number;
  harmless:   number;
  undetected: number;
  reputation: number;
  country:    string | null;
  as_owner:   string | null;
  network:    string | null;
  cached:     boolean;
}

type VtState = VtResult | 'loading' | 'error' | { error: string };

interface BlockedIp {
  id: number;
  ip: string;
  motivo: string | null;
  bloqueadoHasta: string | null;
  createdAt: string;
}

interface SecStats {
  total: number;
  login_fail: number;
  login_ok: number;
  brute_force: number;
  auth_invalid: number;
  unique_ips: number;
  active_sessions: number;
  top_ips: { ip: string; count: number }[];
  hourly: { hora: string; tipo: string; total: number }[];
}

const TIPO_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  login_ok:        { label: 'LOGIN OK',       cls: 'ev-ok',       icon: '\u2713' },
  login_fail:      { label: 'LOGIN FAIL',     cls: 'ev-fail',     icon: '\u2717' },
  brute_force:     { label: 'BRUTE FORCE',    cls: 'ev-critical', icon: '\u26A0' },
  auth_invalid:    { label: 'AUTH INVALID',   cls: 'ev-warn',     icon: '!' },
  register:        { label: 'REGISTER',       cls: 'ev-info',     icon: '\u2192' },
  forbidden:       { label: 'FORBIDDEN',      cls: 'ev-warn',     icon: '\u26D4' },
  honeypot:        { label: 'HONEYPOT',       cls: 'ev-critical', icon: '\uD83C\uDF6F' },
  blocked_request: { label: 'BLOCKED',        cls: 'ev-fail',     icon: '\uD83D\uDEAB' },
};

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
}

// ================================================================
// HELPER: VT badge classification (reduces branching)
// ================================================================
function getVtClassAndLabel(r: VtResult): { cls: string; label: string } {
  const total = r.malicious + r.suspicious + r.harmless + r.undetected;
  if (r.malicious > 0) return { cls: styles.vtMalicious, label: `\u26A0 MALICIOUS ${r.malicious}/${total}` };
  if (r.suspicious > 0) return { cls: styles.vtSuspicious, label: `~ SUSPICIOUS ${r.suspicious}/${total}` };
  if (r.reputation < -10) return { cls: styles.vtWarn, label: `REP ${r.reputation}` };
  return { cls: styles.vtClean, label: '\u2713 CLEAN' };
}

// ================================================================
// HELPER: Threat level from stats (eliminates nested ternaries)
// ================================================================
function getThreatInfo(stats: SecStats | null): { level: string; color: string } {
  if ((stats?.brute_force ?? 0) > 0) return { level: 'CR\u00CDTICO', color: '#ef4444' };
  if ((stats?.login_fail ?? 0) > 10) return { level: 'ALTO', color: '#f59e0b' };
  if ((stats?.login_fail ?? 0) > 3) return { level: 'MEDIO', color: '#eab308' };
  return { level: 'BAJO', color: '#10b981' };
}

// ================================================================
// HELPER: Build hourly chart data
// ================================================================
function buildChartData(stats: SecStats | null) {
  const hourlyMap: Record<string, { hora: string; ok: number; fail: number; brute: number; invalid: number }> = {};
  (stats?.hourly ?? []).forEach(r => {
    const k = r.hora;
    if (!hourlyMap[k]) hourlyMap[k] = { hora: new Date(k).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), ok: 0, fail: 0, brute: 0, invalid: 0 };
    if (r.tipo === 'login_ok')     hourlyMap[k].ok     += r.total;
    if (r.tipo === 'login_fail')   hourlyMap[k].fail   += r.total;
    if (r.tipo === 'brute_force')  hourlyMap[k].brute  += r.total;
    if (r.tipo === 'auth_invalid') hourlyMap[k].invalid += r.total;
  });
  return Object.values(hourlyMap);
}

// ================================================================
// SOC LOGIN FORM (extracted to reduce cognitive complexity)
// ================================================================
interface SocLoginFormProps {
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPass: boolean;
  setShowPass: (fn: (p: boolean) => boolean) => void;
  loginErr: string;
  onLogin: () => void;
}

function SocLoginForm({ username, setUsername, password, setPassword, showPass, setShowPass, loginErr, onLogin }: SocLoginFormProps) {
  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginBox}>
        <div className={styles.loginLogo}>
          <Shield size={40} />
          <span>KRATAMEX SOC</span>
        </div>
        <p className={styles.loginSub}>Security Operations Center &middot; Acceso restringido</p>

        {/* Hidden honeypot inputs -- absorb browser autofill before it reaches real fields */}
        <input type="text" name="username" style={{ display: 'none' }} tabIndex={-1} readOnly />
        <input type="password" name="password" style={{ display: 'none' }} tabIndex={-1} readOnly />

        <div className={styles.loginField}>
          <label htmlFor="soc-user">USUARIO</label>
          <input
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onLogin()}
            placeholder="identificador"
            autoComplete="off"
            name="soc-user"
            id="soc-user"
          />
        </div>
        <div className={styles.loginField}>
          <label htmlFor="soc-pass">CONTRASE&Ntilde;A</label>
          <div className={styles.passWrap}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onLogin()}
              placeholder="&&bull;&&bull;&&bull;&&bull;&&bull;&&bull;&&bull;&&bull;"
              autoComplete="off"
              name="soc-pass"
              id="soc-pass"
            />
            <button onClick={() => setShowPass(p => !p)} type="button">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {loginErr && <p className={styles.loginErr}>{loginErr}</p>}
        <button className={styles.loginBtn} onClick={onLogin}>
          <Lock size={16} /> AUTENTICAR
        </button>
        <Link to="/" className={styles.loginBack}>&larr; Volver a la tienda</Link>
      </div>
    </div>
  );
}

// ================================================================
// EVENT LOG (extracted to reduce cognitive complexity)
// ================================================================
interface EventLogProps {
  events: SecEvent[];
  tipoFiltro: string;
  setTipoFiltro: (v: string) => void;
  exportEvents: (format: 'csv' | 'json') => void;
  renderVtBadge: (ip: string) => React.ReactNode;
  checkVT: (ip: string) => void;
}

function EventLog({ events, tipoFiltro, setTipoFiltro, exportEvents, renderVtBadge, checkVT }: EventLogProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        <Terminal size={14} /> LOG DE EVENTOS
        <div className={styles.filterRow}>
          {['', 'login_fail', 'login_ok', 'brute_force', 'auth_invalid', 'honeypot', 'blocked_request'].map(t => (
            <button key={t}
              className={`${styles.filterBtn} ${tipoFiltro === t ? styles.filterBtnActive : ''}`}
              onClick={() => setTipoFiltro(t)}>
              {t === '' ? 'TODOS' : (TIPO_CONFIG[t]?.label ?? t.toUpperCase())}
            </button>
          ))}
        </div>
        <div className={styles.exportRow}>
          <button className={styles.exportBtn} onClick={() => exportEvents('csv')} title="Exportar CSV">
            <Download size={12} /> CSV
          </button>
          <button className={styles.exportBtn} onClick={() => exportEvents('json')} title="Exportar JSON">
            <Download size={12} /> JSON
          </button>
        </div>
      </div>
      <div className={styles.logTable}>
        <div className={styles.logHeader}>
          <span>TIEMPO</span><span>TIPO</span><span>IP / THREAT INTEL</span><span>USUARIO</span><span>ENDPOINT</span><span>DETALLES</span>
        </div>
        {events.length === 0 ? (
          <div className={styles.emptyLog}>No hay eventos registrados a&uacute;n</div>
        ) : (
          events.map(ev => {
            const cfg = TIPO_CONFIG[ev.tipo] ?? { label: ev.tipo.toUpperCase(), cls: 'ev-info', icon: '\u00B7' };
            const vtBadge = ev.ip ? renderVtBadge(ev.ip) : null;
            return (
              <div key={ev.id} className={`${styles.logRow} ${styles[cfg.cls]}`}>
                <span className={styles.logTime}>{fmtDate(ev.fecha)} {fmtTime(ev.fecha)}</span>
                <span className={`${styles.logBadge} ${styles[cfg.cls]}`}>{cfg.icon} {cfg.label}</span>
                <span className={styles.logIp}>
                  {ev.ip
                    ? <button className={styles.ipClickable} onClick={() => checkVT(ev.ip!)} title="Consultar VirusTotal">{ev.ip}</button>
                    : '\u2014'
                  }
                  {vtBadge && <span className={styles.vtInline}>{vtBadge}</span>}
                </span>
                <span className={styles.logUser}>{ev.username ?? '\u2014'}</span>
                <span className={styles.logEndpoint}>{ev.metodo && ev.endpoint ? `${ev.metodo} ${ev.endpoint}` : '\u2014'}</span>
                <span className={styles.logDetails}>{ev.detalles ?? '\u2014'}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ================================================================
// MAIN COMPONENT
// ================================================================
const SOC_TOKEN_KEY = 'kratamex_soc_token';

export default function SecurityDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem(SOC_TOKEN_KEY) ?? '');
  const [authed, setAuthed] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginErr, setLoginErr] = useState('');

  const [stats, setStats]   = useState<SecStats | null>(null);
  const [events, setEvents] = useState<SecEvent[]>([]);
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [vtResults, setVtResults] = useState<Record<string, VtState>>({});
  const [blockedList, setBlockedList] = useState<BlockedIp[]>([]);
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockMotivo, setBlockMotivo] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  // Restaurar sesi&oacute;n al montar si hay token guardado
  useEffect(() => {
    const saved = localStorage.getItem(SOC_TOKEN_KEY);
    if (!saved) return;
    fetch('/api/security/stats', { headers: { Authorization: saved } }).then(r => {
      if (r.ok) { setAuthed(true); }
      else { localStorage.removeItem(SOC_TOKEN_KEY); setToken(''); }
    }).catch(() => { /* sin conexi&oacute;n -- dejamos el token para reintentar */ });
  }, []);

  const loadData = useCallback(async (tk: string) => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        fetch('/api/security/stats',  { headers: { Authorization: tk } }),
        fetch(`/api/security/events?limit=100${tipoFiltro ? `&tipo=${tipoFiltro}` : ''}`, { headers: { Authorization: tk } }),
      ]);
      if (sRes.ok)  setStats(await sRes.json());
      if (eRes.ok)  setEvents(await eRes.json());
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [tipoFiltro]);

  const checkVT = useCallback(async (ip: string) => {
    if (vtResults[ip] === 'loading') return;
    setVtResults(prev => ({ ...prev, [ip]: 'loading' }));
    try {
      const res = await fetch(`/api/security/ip/${encodeURIComponent(ip)}/threat`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      if (!res.ok) {
        setVtResults(prev => ({ ...prev, [ip]: { error: data.error ?? 'Error desconocido' } }));
        return;
      }
      setVtResults(prev => ({ ...prev, [ip]: data as VtResult }));
    } catch {
      setVtResults(prev => ({ ...prev, [ip]: 'error' }));
    }
  }, [token, vtResults]);

  const loadBlockedIps = useCallback(async (tk: string) => {
    try {
      const res = await fetch('/api/security/blocked-ips', { headers: { Authorization: tk } });
      if (res.ok) setBlockedList(await res.json());
    } catch {}
  }, []);

  const handleBlockIp = async () => {
    const ip = blockIpInput.trim();
    if (!ip) return;
    setBlockLoading(true);
    try {
      const res = await fetch('/api/security/blocked-ips', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, motivo: blockMotivo || 'manual', horas: 24 }),
      });
      if (res.ok) { setBlockIpInput(''); setBlockMotivo(''); loadBlockedIps(token); }
    } finally { setBlockLoading(false); }
  };

  const handleUnblockIp = async (ip: string) => {
    await fetch(`/api/security/blocked-ips/${encodeURIComponent(ip)}`, {
      method: 'DELETE', headers: { Authorization: token },
    });
    loadBlockedIps(token);
  };

  const exportEvents = (format: 'csv' | 'json') => {
    const exportUrl = `/api/security/events/export?format=${format}&limit=1000`;
    fetch(exportUrl, { headers: { Authorization: token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `soc-events-${new Date().toISOString().slice(0,10)}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  useEffect(() => {
    if (!authed) return;
    loadData(token);
    loadBlockedIps(token);
  }, [authed, tipoFiltro, token, loadData, loadBlockedIps]);

  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const id = setInterval(() => { loadData(token); loadBlockedIps(token); }, 15000);
    return () => clearInterval(id);
  }, [authed, autoRefresh, token, loadData, loadBlockedIps]);

  const handleLogin = async () => {
    setLoginErr('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || data.user?.role !== 'admin') {
        setLoginErr(data.error || 'Acceso denegado: se requiere rol admin');
        return;
      }
      localStorage.setItem(SOC_TOKEN_KEY, data.token);
      setToken(data.token);
      setAuthed(true);
    } catch {
      setLoginErr('Error de conexi\u00F3n');
    }
  };

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST', headers: { Authorization: token } });
    localStorage.removeItem(SOC_TOKEN_KEY);
    setAuthed(false); setToken(''); setUsername(''); setPassword('');
  };

  // -- LOGIN -------------------------------------------------------
  if (!authed) {
    return (
      <SocLoginForm
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        showPass={showPass}
        setShowPass={setShowPass}
        loginErr={loginErr}
        onLogin={handleLogin}
      />
    );
  }

  // -- Preparar datos para charts ----------------------------------
  const chartData = buildChartData(stats);

  function renderVtBadge(ip: string) {
    const vt = vtResults[ip];
    if (!vt) return null;
    if (vt === 'loading') return <span className={styles.vtLoading}>consultando...</span>;
    if (vt === 'error')   return <span className={styles.vtErr}>error</span>;
    if ('error' in vt)    return <span className={styles.vtErr}>{vt.error}</span>;
    const r = vt;
    const { cls, label } = getVtClassAndLabel(r);
    return (
      <span className={styles.vtResult}>
        <span className={`${styles.vtBadge} ${cls}`}>{label}</span>
        {r.country  && <span className={styles.vtMeta}>{r.country}</span>}
        {r.as_owner && <span className={styles.vtMeta} title={r.network ?? ''}>{r.as_owner.slice(0, 22)}</span>}
        {r.cached   && <span className={styles.vtCached}>{'\u21A9'} cach\u00E9</span>}
      </span>
    );
  }

  const { level: threatLevel, color: threatColor } = getThreatInfo(stats);

  // -- DASHBOARD ---------------------------------------------------
  return (
    <div className={styles.wrap}>
      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Shield size={22} className={styles.headerIcon} />
          <span className={styles.headerTitle}>KRATAMEX</span>
          <span className={styles.headerSub}>SECURITY OPERATIONS CENTER</span>
          <span className={styles.headerBlink} />
        </div>
        <div className={styles.headerRight}>
          {lastRefresh && (
            <span className={styles.refreshTime}>
              Actualizado {lastRefresh.toLocaleTimeString('es-ES')}
            </span>
          )}
          <button className={`${styles.iconBtn} ${autoRefresh ? styles.iconBtnActive : ''}`}
            onClick={() => setAutoRefresh(p => !p)} title="Auto-refresh cada 15s">
            <Activity size={16} />
          </button>
          <button className={styles.iconBtn} onClick={() => loadData(token)} title="Refrescar ahora" disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spin : ''} />
          </button>
          <Link to="/admin" className={styles.iconBtn} title="Panel Admin">
            <Terminal size={16} />
          </Link>
          <Link to="/" className={styles.iconBtn} title="Tienda">
            <Globe size={16} />
          </Link>
          <button className={styles.iconBtn} onClick={handleLogout} title="Cerrar sesi\u00F3n">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* STAT CARDS */}
        <div className={styles.statsRow}>
          {/* Threat level */}
          <div className={`${styles.statCard} ${styles.statCardThreat}`}
            style={{ borderColor: threatColor, boxShadow: `0 0 20px ${threatColor}22` }}>
            <Shield size={15} className={styles.statIcon} style={{ color: threatColor, opacity: 0.3 }} />
            <div className={styles.statLabel}>NIVEL AMENAZA</div>
            <div className={styles.statValue} style={{ color: threatColor, textShadow: `0 0 16px ${threatColor}88`, fontSize: '1.5rem' }}>{threatLevel}</div>
            <div className={styles.statSub}>{'\u00FA'}ltimas 24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(245,158,11,0.2)', boxShadow: '0 0 20px rgba(245,158,11,0.06)' }}>
            <AlertTriangle size={15} className={styles.statIcon} style={{ color: '#f59e0b', opacity: 0.25 }} />
            <div className={styles.statLabel}>FALLOS LOGIN</div>
            <div className={styles.statValue} style={{ color: '#fbbf24', textShadow: '0 0 12px rgba(245,158,11,0.5)' }}>{stats?.login_fail ?? '\u2014'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(239,68,68,0.25)', boxShadow: '0 0 20px rgba(239,68,68,0.07)' }}>
            <XCircle size={15} className={styles.statIcon} style={{ color: '#ef4444', opacity: 0.25 }} />
            <div className={styles.statLabel}>BRUTE FORCE</div>
            <div className={styles.statValue} style={{ color: '#f87171', textShadow: '0 0 12px rgba(239,68,68,0.5)' }}>{stats?.brute_force ?? '\u2014'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(16,185,129,0.2)', boxShadow: '0 0 20px rgba(16,185,129,0.05)' }}>
            <CheckCircle size={15} className={styles.statIcon} style={{ color: '#10b981', opacity: 0.25 }} />
            <div className={styles.statLabel}>LOGINS OK</div>
            <div className={styles.statValue} style={{ color: '#34d399', textShadow: '0 0 12px rgba(16,185,129,0.5)' }}>{stats?.login_ok ?? '\u2014'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(99,102,241,0.2)', boxShadow: '0 0 20px rgba(99,102,241,0.06)' }}>
            <Lock size={15} className={styles.statIcon} style={{ color: '#6366f1', opacity: 0.25 }} />
            <div className={styles.statLabel}>TOKEN INV{'\u00C1'}LIDOS</div>
            <div className={styles.statValue} style={{ color: '#a5b4fc', textShadow: '0 0 12px rgba(99,102,241,0.5)' }}>{stats?.auth_invalid ?? '\u2014'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(34,211,238,0.2)', boxShadow: '0 0 20px rgba(34,211,238,0.05)' }}>
            <Wifi size={15} className={styles.statIcon} style={{ color: '#22d3ee', opacity: 0.25 }} />
            <div className={styles.statLabel}>IPs {'\u00DA'}NICAS</div>
            <div className={styles.statValue} style={{ color: '#67e8f9', textShadow: '0 0 12px rgba(34,211,238,0.5)' }}>{stats?.unique_ips ?? '\u2014'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(167,139,250,0.2)', boxShadow: '0 0 20px rgba(167,139,250,0.05)' }}>
            <Users size={15} className={styles.statIcon} style={{ color: '#a78bfa', opacity: 0.25 }} />
            <div className={styles.statLabel}>SESIONES ACTIVAS</div>
            <div className={styles.statValue} style={{ color: '#c4b5fd', textShadow: '0 0 12px rgba(167,139,250,0.5)' }}>{stats?.active_sessions ?? '\u2014'}</div>
            <div className={styles.statSub}>ahora</div>
          </div>
        </div>

        {/* CHART + TOP IPs */}
        <div className={styles.midRow}>
          <div className={`${styles.panel} ${styles.panelChart}`}>
            <div className={styles.panelTitle}><Activity size={14} /> ACTIVIDAD {'\u00DA'}LTIMAS 24H</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOk"    x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gFail"  x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gBrute" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#ef4444" stopOpacity={0.45}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="hora" tick={{ fill: '#2d4a5e', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#2d4a5e', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#040f1c', border: '1px solid rgba(0,232,122,0.15)', color: '#7fa8c0', fontSize: 12, borderRadius: 8, fontFamily: 'JetBrains Mono, monospace' }}
                  cursor={{ stroke: 'rgba(0,232,122,0.15)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="ok"    stroke="#10b981" fill="url(#gOk)"    name="Login OK"     strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="fail"  stroke="#f59e0b" fill="url(#gFail)"  name="Login Fail"   strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="brute" stroke="#ef4444" fill="url(#gBrute)" name="Brute Force"  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className={`${styles.panel} ${styles.panelTopIps}`}>
            <div className={styles.panelTitle}><Globe size={14} /> TOP IPs (24H)</div>
            {stats?.top_ips && stats.top_ips.length > 0 ? (
              <div className={styles.ipList}>
                {stats.top_ips.map((r, i) => {
                  const max = stats.top_ips[0].count;
                  const pct = Math.round((r.count / max) * 100);
                  const vtBadge = renderVtBadge(r.ip);
                  return (
                    <div key={r.ip} className={styles.ipEntry}>
                      <div className={styles.ipRow}>
                        <span className={styles.ipRank}>#{i+1}</span>
                        <span className={styles.ipAddr}>{r.ip}</span>
                        <div className={styles.ipBar}>
                          <div className={styles.ipBarFill} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={styles.ipCount}>{r.count} ev.</span>
                        <button
                          className={`${styles.vtBtn} ${vtResults[r.ip] ? styles.vtBtnDone : ''}`}
                          onClick={() => checkVT(r.ip)}
                          title="Consultar VirusTotal Threat Intelligence"
                          disabled={vtResults[r.ip] === 'loading'}
                        >
                          <Search size={10} /> VT
                        </button>
                      </div>
                      {vtBadge && <div className={styles.vtRow}>{vtBadge}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.empty}>Sin datos</p>
            )}
          </div>
        </div>

        {/* BLOCKED IPs PANEL */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            <Ban size={14} /> IPs BLOQUEADAS
            <span className={styles.blockedCount}>{blockedList.length}</span>
          </div>
          <div className={styles.blockForm}>
            <input
              className={styles.blockInput}
              placeholder="IP a bloquear (ej: 1.2.3.4)"
              value={blockIpInput}
              onChange={e => setBlockIpInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleBlockIp()}
            />
            <input
              className={styles.blockInput}
              placeholder="Motivo (opcional)"
              value={blockMotivo}
              onChange={e => setBlockMotivo(e.target.value)}
            />
            <button className={styles.blockBtn} onClick={handleBlockIp} disabled={blockLoading || !blockIpInput.trim()}>
              <Ban size={12} /> Bloquear 24h
            </button>
          </div>
          <div className={styles.blockedTable}>
            {blockedList.length === 0 ? (
              <div className={styles.emptyLog}>Sin IPs bloqueadas</div>
            ) : blockedList.map(b => (
              <div key={b.id} className={styles.blockedRow}>
                <span className={styles.blockedIp}>{b.ip}</span>
                <span className={styles.blockedMotivo}>{b.motivo ?? '\u2014'}</span>
                <span className={styles.blockedHasta}>
                  {b.bloqueadoHasta
                    ? `hasta ${new Date(b.bloqueadoHasta).toLocaleString('es-ES')}`
                    : 'permanente'}
                </span>
                <button className={styles.unblockBtn} onClick={() => handleUnblockIp(b.ip)} title="Desbloquear">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* EVENT LOG */}
        <EventLog
          events={events}
          tipoFiltro={tipoFiltro}
          setTipoFiltro={setTipoFiltro}
          exportEvents={exportEvents}
          renderVtBadge={renderVtBadge}
          checkVT={checkVT}
        />
      </div>
    </div>
  );
}
