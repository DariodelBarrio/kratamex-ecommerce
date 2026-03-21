import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, MapPin, Phone, Globe, Camera, Save } from 'lucide-react';
import { getUsuario, updatePerfil } from '../api';
import { t, setLang, getLang } from '../i18n';
import type { Usuario } from '../interfaces';

// =================================================================
// USER PROFILE
// =================================================================

interface UserProfileProps {
  user: Usuario;
}

export default function UserProfile({ user }: UserProfileProps) {
  const queryClient = useQueryClient();

  // Fetch latest user data
  const { data } = useQuery({
    queryKey: ['usuario'],
    queryFn: getUsuario,
    initialData: { user },
  });

  const currentUser: Usuario = data?.user ?? user;

  const [nombre, setNombre] = useState(currentUser.nombre ?? '');
  const [email, setEmail] = useState(currentUser.email ?? '');
  const [direccion, setDireccion] = useState(currentUser.direccion ?? '');
  const [telefono, setTelefono] = useState(currentUser.telefono ?? '');
  const [idioma, setIdioma] = useState<'es' | 'en'>(
    (currentUser.idioma as 'es' | 'en') ?? getLang(),
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    currentUser.avatar ?? null,
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep form in sync when remote data arrives
  useEffect(() => {
    if (data?.user) {
      const u = data.user as Usuario;
      setNombre(u.nombre ?? '');
      setEmail(u.email ?? '');
      setDireccion(u.direccion ?? '');
      setTelefono(u.telefono ?? '');
      setIdioma((u.idioma as 'es' | 'en') ?? getLang());
      setAvatarPreview(u.avatar ?? null);
    }
  }, [data]);

  // Save mutation
  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload: Record<string, string>) => updatePerfil(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuario'] });
      showToast(t('profile.saved'));
    },
    onError: (err: Error) => {
      showToast(err.message);
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Avatar pick
  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  // Language change
  function handleLanguageChange(lang: 'es' | 'en') {
    setIdioma(lang);
    setLang(lang);
  }

  // Submit
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string> = {
      nombre,
      email,
      direccion,
      telefono,
      idioma,
    };
    if (avatarFile) {
      // Send base64 preview as avatar data
      if (avatarPreview) payload.avatar = avatarPreview;
    }
    save(payload);
  }

  // Role badge config
  const roleBadge: Record<string, { label: string; color: string }> = {
    admin: { label: 'Admin', color: '#ef4444' },
    user: { label: 'Usuario', color: 'var(--accent)' },
  };
  const badge = roleBadge[currentUser.role] ?? {
    label: currentUser.role,
    color: 'var(--accent)',
  };

  // ---- Styles ----
  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)',
    borderRadius: 16,
    padding: '32px',
    maxWidth: 520,
    margin: '0 auto',
    border: '1px solid var(--border-color)',
  };

  const fieldWrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 18,
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
  };

  const inputStyle: React.CSSProperties = {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid var(--border-color)',
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s',
    width: '100%',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '12px 28px',
    borderRadius: 10,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    width: '100%',
    marginTop: 8,
  };

  const avatarContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: 96,
    height: 96,
    borderRadius: '50%',
    margin: '0 auto 20px',
    cursor: 'pointer',
  };

  const avatarImgStyle: React.CSSProperties = {
    width: 96,
    height: 96,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid var(--accent)',
  };

  const avatarPlaceholderStyle: React.CSSProperties = {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: 'var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '3px solid var(--accent)',
  };

  const cameraOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid var(--card-bg)',
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    background: badge.color,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  };

  const usernameStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: 4,
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
  };

  const roleSectionStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 24,
  };

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--accent)',
    color: '#fff',
    padding: '12px 28px',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 14,
    zIndex: 9999,
    pointerEvents: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
  };

  return (
    <>
      <motion.div
        style={cardStyle}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Title */}
        <h2
          style={{
            textAlign: 'center',
            color: 'var(--text-primary)',
            marginBottom: 24,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {t('profile.title')}
        </h2>

        {/* Avatar */}
        <motion.div
          style={avatarContainerStyle}
          onClick={handleAvatarClick}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="avatar" style={avatarImgStyle} />
          ) : (
            <div style={avatarPlaceholderStyle}>
              <User size={40} color="var(--text-secondary)" />
            </div>
          )}
          <div style={cameraOverlayStyle}>
            <Camera size={15} color="#fff" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
          />
        </motion.div>

        {/* Username & Role */}
        <p style={usernameStyle}>{currentUser.username}</p>
        <div style={roleSectionStyle}>
          <span style={badgeStyle}>{badge.label}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Nombre */}
          <div style={fieldWrapperStyle}>
            <label style={labelStyle}>
              <User size={15} />
              {t('auth.name')}
            </label>
            <motion.input
              style={inputStyle}
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t('auth.name')}
              whileFocus={{ borderColor: 'var(--accent)' }}
            />
          </div>

          {/* Email */}
          <div style={fieldWrapperStyle}>
            <label style={labelStyle}>
              <Mail size={15} />
              {t('auth.email')}
            </label>
            <motion.input
              style={inputStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
              whileFocus={{ borderColor: 'var(--accent)' }}
            />
          </div>

          {/* Direccion */}
          <div style={fieldWrapperStyle}>
            <label style={labelStyle}>
              <MapPin size={15} />
              {t('profile.address')}
            </label>
            <motion.input
              style={inputStyle}
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder={t('profile.address')}
              whileFocus={{ borderColor: 'var(--accent)' }}
            />
          </div>

          {/* Telefono */}
          <div style={fieldWrapperStyle}>
            <label style={labelStyle}>
              <Phone size={15} />
              {t('profile.phone')}
            </label>
            <motion.input
              style={inputStyle}
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder={t('profile.phone')}
              whileFocus={{ borderColor: 'var(--accent)' }}
            />
          </div>

          {/* Idioma */}
          <div style={fieldWrapperStyle}>
            <label style={labelStyle}>
              <Globe size={15} />
              {t('profile.language')}
            </label>
            <select
              style={selectStyle}
              value={idioma}
              onChange={(e) =>
                handleLanguageChange(e.target.value as 'es' | 'en')
              }
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            style={{
              ...btnStyle,
              opacity: isPending ? 0.7 : 1,
            }}
            disabled={isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Save size={17} />
            {isPending ? '...' : t('profile.save')}
          </motion.button>
        </form>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            style={toastStyle}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.25 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
