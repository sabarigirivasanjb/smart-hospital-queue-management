import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      const { access_token, role, user_id, full_name } = res.data;
      const userData = { token: access_token, role, id: user_id, full_name, email };
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true, role };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: '⚠️ Cannot connect to server. Please run START_PROJECT.bat first.' };
      }
      const status = err.response.status;
      const detail = err.response?.data?.detail;
      if (status === 401) return { success: false, error: '❌ Wrong email or password. Try again.' };
      if (status === 403) return { success: false, error: '🚫 Account is disabled. Contact admin.' };
      return { success: false, error: detail || 'Login failed. Try again.' };
    } finally {
      setLoading(false);
    }
  };

  const register = async (data) => {
    setLoading(true);
    try {
      const res = await authAPI.register(data);
      const { access_token, role, user_id, full_name } = res.data;
      const userData = { token: access_token, role, id: user_id, full_name, email: data.email };
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true, role };
    } catch (err) {
      if (!err.response) {
        return { success: false, error: '⚠️ Cannot connect to server. Please run START_PROJECT.bat first.' };
      }
      const status = err.response.status;
      const detail = err.response?.data?.detail;
      if (status === 400 && detail?.toLowerCase().includes('already')) {
        return { success: false, error: '📧 This email is already registered. Please sign in instead.' };
      }
      if (status === 422) {
        const msg = err.response?.data?.detail;
        if (Array.isArray(msg)) {
          return { success: false, error: '⚠️ ' + msg.map(e => e.msg).join(', ') };
        }
      }
      return { success: false, error: detail || 'Registration failed. Try again.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
