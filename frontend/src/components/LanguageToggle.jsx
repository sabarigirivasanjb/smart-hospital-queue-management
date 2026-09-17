// LanguageToggle.jsx — EN / தமிழ் switch button
import { useLanguage } from '../i18n';

export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
      title={lang === 'en' ? 'Switch to Tamil' : 'Switch to English'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 20,
        color: 'var(--color-primary)',
        cursor: 'pointer',
        fontSize: '0.82rem',
        fontWeight: 700,
        transition: 'all 0.2s',
        letterSpacing: '0.5px',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(66,165,245,0.18)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
    >
      <span style={{ fontSize: '1rem' }}>🌐</span>
      {lang === 'en' ? (
        <span>தமிழ்</span>
      ) : (
        <span>English</span>
      )}
    </button>
  );
}
