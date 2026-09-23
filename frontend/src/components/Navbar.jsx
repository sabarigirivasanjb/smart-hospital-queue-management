import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ unreadCount = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <a className="navbar-brand" href="/">
          <div className="brand-icon">🏥</div>
          SmartQueue
          {user && (
            <span className={`navbar-role-badge ${user.role}`}>
              {user.role === 'patient' ? '🏥' : user.role === 'doctor' ? '🩺' : user.role === 'reception' ? '📋' : '⚙️'} {user.role}
            </span>
          )}
        </a>

        <div className="navbar-actions">
          {user && (
            <>
              <div style={{ textAlign: 'right', display: 'grid' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.full_name}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{user.email}</span>
              </div>

              {unreadCount > 0 && (
                <div style={{
                  background: 'var(--color-danger)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}>
                  {unreadCount}
                </div>
              )}

              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                🚪 Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
