import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, Users, Wifi, Lock, RefreshCw, LogOut, Terminal, Eye, EyeOff, Globe } from 'lucide-react';
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
  login_ok:     { label: 'LOGIN OK',      cls: 'ev-ok',      icon: '✓' },
  login_fail:   { label: 'LOGIN FAIL',    cls: 'ev-fail',    icon: '✗' },
  brute_force:  { label: 'BRUTE FORCE',   cls: 'ev-critical', icon: '⚠' },
  auth_invalid: { label: 'AUTH INVALID',  cls: 'ev-warn',    icon: '!' },
  register:     { label: 'REGISTER',      cls: 'ev-info',    icon: '→' },
  forbidden:    { label: 'FORBIDDEN',     cls: 'ev-warn',    icon: '⛔' },
};

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
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

  // Restaurar sesión al montar si hay token guardado
  useEffect(() => {
    const saved = localStorage.getItem(SOC_TOKEN_KEY);
    if (!saved) return;
    fetch('/api/security/stats', { headers: { Authorization: saved } }).then(r => {
      if (r.ok) { setAuthed(true); }
      else { localStorage.removeItem(SOC_TOKEN_KEY); setToken(''); }
    }).catch(() => { /* sin conexión — dejamos el token para reintentar */ });
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

  useEffect(() => {
    if (!authed) return;
    loadData(token);
  }, [authed, tipoFiltro, token, loadData]);

  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const id = setInterval(() => loadData(token), 15000);
    return () => clearInterval(id);
  }, [authed, autoRefresh, token, loadData]);

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
      setLoginErr('Error de conexión');
    }
  };

  const handleLogout = () => {
    fetch('/api/logout', { method: 'POST', headers: { Authorization: token } });
    localStorage.removeItem(SOC_TOKEN_KEY);
    setAuthed(false); setToken(''); setUsername(''); setPassword('');
  };

  // ── LOGIN ──────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className={styles.loginWrap}>
        <div className={styles.loginBox}>
          <div className={styles.loginLogo}>
            <Shield size={40} />
            <span>KRATAMEX SOC</span>
          </div>
          <p className={styles.loginSub}>Security Operations Center · Acceso restringido</p>

          {/* Hidden honeypot inputs — absorb browser autofill before it reaches real fields */}
          <input type="text" name="username" style={{ display: 'none' }} tabIndex={-1} readOnly />
          <input type="password" name="password" style={{ display: 'none' }} tabIndex={-1} readOnly />

          <div className={styles.loginField}>
            <label>USUARIO</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="identificador"
              autoComplete="off"
              name="soc-user"
              id="soc-user"
            />
          </div>
          <div className={styles.loginField}>
            <label>CONTRASEÑA</label>
            <div className={styles.passWrap}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
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
          <button className={styles.loginBtn} onClick={handleLogin}>
            <Lock size={16} /> AUTENTICAR
          </button>
          <Link to="/" className={styles.loginBack}>← Volver a la tienda</Link>
        </div>
      </div>
    );
  }

  // ── Preparar datos para charts ────────────────────────────────
  const hourlyMap: Record<string, { hora: string; ok: number; fail: number; brute: number; invalid: number }> = {};
  (stats?.hourly ?? []).forEach(r => {
    const k = r.hora;
    if (!hourlyMap[k]) hourlyMap[k] = { hora: new Date(k).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), ok: 0, fail: 0, brute: 0, invalid: 0 };
    if (r.tipo === 'login_ok')     hourlyMap[k].ok     += r.total;
    if (r.tipo === 'login_fail')   hourlyMap[k].fail   += r.total;
    if (r.tipo === 'brute_force')  hourlyMap[k].brute  += r.total;
    if (r.tipo === 'auth_invalid') hourlyMap[k].invalid += r.total;
  });
  const chartData = Object.values(hourlyMap);

  const threatLevel = (stats?.brute_force ?? 0) > 0 ? 'CRÍTICO'
    : (stats?.login_fail ?? 0) > 10 ? 'ALTO'
    : (stats?.login_fail ?? 0) > 3  ? 'MEDIO'
    : 'BAJO';
  const threatColor = threatLevel === 'CRÍTICO' ? '#ef4444' : threatLevel === 'ALTO' ? '#f59e0b' : threatLevel === 'MEDIO' ? '#eab308' : '#10b981';

  // ── DASHBOARD ─────────────────────────────────────────────────
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
          <button className={styles.iconBtn} onClick={handleLogout} title="Cerrar sesión">
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
            <div className={styles.statSub}>últimas 24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(245,158,11,0.2)', boxShadow: '0 0 20px rgba(245,158,11,0.06)' }}>
            <AlertTriangle size={15} className={styles.statIcon} style={{ color: '#f59e0b', opacity: 0.25 }} />
            <div className={styles.statLabel}>FALLOS LOGIN</div>
            <div className={styles.statValue} style={{ color: '#fbbf24', textShadow: '0 0 12px rgba(245,158,11,0.5)' }}>{stats?.login_fail ?? '—'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(239,68,68,0.25)', boxShadow: '0 0 20px rgba(239,68,68,0.07)' }}>
            <XCircle size={15} className={styles.statIcon} style={{ color: '#ef4444', opacity: 0.25 }} />
            <div className={styles.statLabel}>BRUTE FORCE</div>
            <div className={styles.statValue} style={{ color: '#f87171', textShadow: '0 0 12px rgba(239,68,68,0.5)' }}>{stats?.brute_force ?? '—'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(16,185,129,0.2)', boxShadow: '0 0 20px rgba(16,185,129,0.05)' }}>
            <CheckCircle size={15} className={styles.statIcon} style={{ color: '#10b981', opacity: 0.25 }} />
            <div className={styles.statLabel}>LOGINS OK</div>
            <div className={styles.statValue} style={{ color: '#34d399', textShadow: '0 0 12px rgba(16,185,129,0.5)' }}>{stats?.login_ok ?? '—'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(99,102,241,0.2)', boxShadow: '0 0 20px rgba(99,102,241,0.06)' }}>
            <Lock size={15} className={styles.statIcon} style={{ color: '#6366f1', opacity: 0.25 }} />
            <div className={styles.statLabel}>TOKEN INVÁLIDOS</div>
            <div className={styles.statValue} style={{ color: '#a5b4fc', textShadow: '0 0 12px rgba(99,102,241,0.5)' }}>{stats?.auth_invalid ?? '—'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(34,211,238,0.2)', boxShadow: '0 0 20px rgba(34,211,238,0.05)' }}>
            <Wifi size={15} className={styles.statIcon} style={{ color: '#22d3ee', opacity: 0.25 }} />
            <div className={styles.statLabel}>IPs ÚNICAS</div>
            <div className={styles.statValue} style={{ color: '#67e8f9', textShadow: '0 0 12px rgba(34,211,238,0.5)' }}>{stats?.unique_ips ?? '—'}</div>
            <div className={styles.statSub}>24h</div>
          </div>

          <div className={styles.statCard} style={{ borderColor: 'rgba(167,139,250,0.2)', boxShadow: '0 0 20px rgba(167,139,250,0.05)' }}>
            <Users size={15} className={styles.statIcon} style={{ color: '#a78bfa', opacity: 0.25 }} />
            <div className={styles.statLabel}>SESIONES ACTIVAS</div>
            <div className={styles.statValue} style={{ color: '#c4b5fd', textShadow: '0 0 12px rgba(167,139,250,0.5)' }}>{stats?.active_sessions ?? '—'}</div>
            <div className={styles.statSub}>ahora</div>
          </div>
        </div>

        {/* CHART + TOP IPs */}
        <div className={styles.midRow}>
          <div className={`${styles.panel} ${styles.panelChart}`}>
            <div className={styles.panelTitle}><Activity size={14} /> ACTIVIDAD ÚLTIMAS 24H</div>
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
                  return (
                    <div key={r.ip} className={styles.ipRow}>
                      <span className={styles.ipRank}>#{i+1}</span>
                      <span className={styles.ipAddr}>{r.ip}</span>
                      <div className={styles.ipBar}>
                        <div className={styles.ipBarFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.ipCount}>{r.count} ev.</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={styles.empty}>Sin datos</p>
            )}
          </div>
        </div>

        {/* EVENT LOG */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>
            <Terminal size={14} /> LOG DE EVENTOS
            <div className={styles.filterRow}>
              {['', 'login_fail', 'login_ok', 'brute_force', 'auth_invalid'].map(t => (
                <button key={t}
                  className={`${styles.filterBtn} ${tipoFiltro === t ? styles.filterBtnActive : ''}`}
                  onClick={() => setTipoFiltro(t)}>
                  {t === '' ? 'TODOS' : (TIPO_CONFIG[t]?.label ?? t.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.logTable}>
            <div className={styles.logHeader}>
              <span>TIEMPO</span><span>TIPO</span><span>IP</span><span>USUARIO</span><span>ENDPOINT</span><span>DETALLES</span>
            </div>
            {events.length === 0 ? (
              <div className={styles.emptyLog}>No hay eventos registrados aún</div>
            ) : (
              events.map(ev => {
                const cfg = TIPO_CONFIG[ev.tipo] ?? { label: ev.tipo.toUpperCase(), cls: 'ev-info', icon: '·' };
                return (
                  <div key={ev.id} className={`${styles.logRow} ${styles[cfg.cls]}`}>
                    <span className={styles.logTime}>{fmtDate(ev.fecha)} {fmtTime(ev.fecha)}</span>
                    <span className={`${styles.logBadge} ${styles[cfg.cls]}`}>{cfg.icon} {cfg.label}</span>
                    <span className={styles.logIp}>{ev.ip ?? '—'}</span>
                    <span className={styles.logUser}>{ev.username ?? '—'}</span>
                    <span className={styles.logEndpoint}>{ev.metodo && ev.endpoint ? `${ev.metodo} ${ev.endpoint}` : '—'}</span>
                    <span className={styles.logDetails}>{ev.detalles ?? '—'}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
