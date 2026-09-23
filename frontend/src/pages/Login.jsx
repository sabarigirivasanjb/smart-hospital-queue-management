import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DEMO_ACCOUNTS = [
  { role: 'admin',     icon: '🛡️', label: 'Admin',     email: 'admin@hospital.com',         password: 'Admin@123' },
  { role: 'doctor',    icon: '👨‍⚕️', label: 'Doctor',    email: 'arjun.ramesh@hospital.com', password: 'Doctor@123' },
  { role: 'reception', icon: '📋', label: 'Reception', email: 'reception@hospital.com',     password: 'Reception@123' },
  { role: 'patient',   icon: '🏥', label: 'Patient',   email: 'rahul.gupta@email.com',     password: 'Patient@123' },
];

export default function Login() {
  const [tab, setTab]   = useState('login');
  const [form, setForm] = useState({
    email: '', password: '', full_name: '', phone: '',
    role: 'patient', age: '', blood_group: '',
  });
  const [showPwd, setShowPwd] = useState(false);
  const [fieldErr, setFieldErr] = useState({});
  const { login, register, loading } = useAuth();
  const navigate = useNavigate();

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFieldErr(e => ({ ...e, [k]: '' })); };

  // ── Validate register form ──────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.full_name.trim())            e.full_name = 'Name is required';
    if (!form.email.includes('@'))         e.email     = 'Valid email required';
    if (form.password.length < 6)          e.password  = 'Min 6 characters';
    if (form.age && (form.age < 1 || form.age > 120)) e.age = 'Enter valid age';
    return e;
  };

  // ── Login ───────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please enter email and password');
      return;
    }
    const res = await login(form.email.trim(), form.password);
    if (res.success) {
      toast.success(`Welcome back! 👋`);
      navigate(`/${res.role}`);
    } else {
      toast.error(res.error || 'Login failed. Check email/password.');
    }
  };

  // ── Register ────────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setFieldErr(errs);
      toast.error('Please fix the errors below');
      return;
    }
    const payload = {
      email:       form.email.trim(),
      password:    form.password,
      full_name:   form.full_name.trim(),
      phone:       form.phone.trim() || undefined,
      role:        form.role,
      age:         form.age ? parseInt(form.age) : undefined,
      blood_group: form.blood_group || undefined,
    };
    const res = await register(payload);
    if (res.success) {
      toast.success('Account created! 🎉');
      navigate(`/${res.role}`);
    } else {
      toast.error(res.error || 'Registration failed. Try again.');
    }
  };

  const fillDemo = (acc) => {
    setForm(f => ({ ...f, email: acc.email, password: acc.password }));
    setTab('login');
    toast(`Demo: ${acc.label} account filled ✅`, { icon: acc.icon });
  };

  // ── Styles ──────────────────────────────────────────────────────────
  const inputStyle = (key) => ({
    width: '100%', padding: '11px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${fieldErr[key] ? '#ef5350' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: 10, color: 'var(--text-primary)',
    fontSize: '0.95rem', outline: 'none',
    transition: 'border 0.2s',
    boxSizing: 'border-box',
  });

  const labelStyle = {
    display: 'block', fontSize: '0.78rem', fontWeight: 700,
    color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.4px',
  };

  const errStyle = { color: '#ef5350', fontSize: '0.72rem', marginTop: 4 };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 20%, hsl(230,60%,12%), hsl(230,40%,6%) 60%, hsl(220,50%,4%))',
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '36px 32px',
        boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        animation: 'fadeUp 0.4s ease',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🏥</div>
          <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)' }}>SmartQueue</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
            AI-Powered Hospital Management System
          </div>
        </div>

        {/* Demo Quick Fill */}
        <div style={{
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 12, padding: '12px 14px', marginBottom: 20,
        }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.5px' }}>
            ⚡ QUICK DEMO LOGIN
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button key={acc.role} onClick={() => fillDemo(acc)} style={{
                flex: 1, padding: '7px 4px', fontSize: '0.75rem', fontWeight: 600,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              >
                {acc.icon}<br />{acc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Switch */}
        <div style={{
          display: 'flex', background: 'rgba(255,255,255,0.05)',
          borderRadius: 12, padding: 4, marginBottom: 24,
        }}>
          {['login', 'register'].map(t => (
            <button key={t} onClick={() => { setTab(t); setFieldErr({}); }} style={{
              flex: 1, padding: '9px', borderRadius: 9, border: 'none',
              fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
              transition: 'all 0.25s',
              background: tab === t ? 'var(--color-primary)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-muted)',
            }}>
              {t === 'login' ? '🔐 Sign In' : '✨ Register'}
            </button>
          ))}
        </div>

        {/* ── LOGIN FORM ── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>EMAIL ADDRESS</label>
              <input
                type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)}
                style={inputStyle('email')} autoComplete="email" required
              />
            </div>
            <div>
              <label style={labelStyle}>PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  style={{ ...inputStyle('password'), paddingRight: 44 }}
                  autoComplete="current-password" required
                />
                <button type="button" onClick={() => setShowPwd(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)',
                }}>{showPwd ? '🙈' : '👁️'}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{
              padding: '13px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, hsl(230,80%,60%), hsl(260,80%,60%))',
              color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            }}>
              {loading ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : '🔐'}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Full Name */}
            <div>
              <label style={labelStyle}>FULL NAME *</label>
              <input placeholder="e.g. Ramesh Kumar"
                value={form.full_name} onChange={e => set('full_name', e.target.value)}
                style={inputStyle('full_name')} required
              />
              {fieldErr.full_name && <div style={errStyle}>⚠️ {fieldErr.full_name}</div>}
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>EMAIL ADDRESS *</label>
              <input type="email" placeholder="you@example.com"
                value={form.email} onChange={e => set('email', e.target.value)}
                style={inputStyle('email')} autoComplete="email" required
              />
              {fieldErr.email && <div style={errStyle}>⚠️ {fieldErr.email}</div>}
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>PASSWORD * <span style={{ fontWeight: 400, opacity: 0.6 }}>(min 6 chars)</span></label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} placeholder="Min. 6 characters"
                  value={form.password} onChange={e => set('password', e.target.value)}
                  style={{ ...inputStyle('password'), paddingRight: 44 }} required
                />
                <button type="button" onClick={() => setShowPwd(s => !s)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)',
                }}>{showPwd ? '🙈' : '👁️'}</button>
              </div>
              {fieldErr.password && <div style={errStyle}>⚠️ {fieldErr.password}</div>}
            </div>

            {/* Phone + Age */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>PHONE</label>
                <input placeholder="9876543210"
                  value={form.phone} onChange={e => set('phone', e.target.value)}
                  style={inputStyle('phone')}
                />
              </div>
              <div>
                <label style={labelStyle}>AGE</label>
                <input type="number" placeholder="25" min="1" max="120"
                  value={form.age} onChange={e => set('age', e.target.value)}
                  style={inputStyle('age')}
                />
                {fieldErr.age && <div style={errStyle}>⚠️ {fieldErr.age}</div>}
              </div>
            </div>

            {/* Blood Group + Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>BLOOD GROUP</label>
                <select value={form.blood_group} onChange={e => set('blood_group', e.target.value)}
                  style={{ ...inputStyle('blood_group'), cursor: 'pointer' }}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>REGISTER AS</label>
                <select value={form.role} onChange={e => set('role', e.target.value)}
                  style={{ ...inputStyle('role'), cursor: 'pointer' }}>
                  <option value="patient">🏥 Patient</option>
                  <option value="doctor">👨‍⚕️ Doctor</option>
                  <option value="reception">📋 Reception</option>
                  <option value="admin">🛡️ Admin</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: '13px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, hsl(142,70%,35%), hsl(160,70%,30%))',
              color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
            }}>
              {loading ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : '✨'}
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          SmartQueue Hospital v2.0 — AI-Powered Queue System
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        input:focus, select:focus { border-color: hsl(230,80%,60%) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
      `}</style>
    </div>
  );
}
