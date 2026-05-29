import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('hs_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('hs_token', data.accessToken);
    localStorage.setItem('hs_user', JSON.stringify({
      id: data.userId, email: data.email, displayName: data.displayName
    }));
    setUser({ id: data.userId, email: data.email, displayName: data.displayName });
    return data;
  };

  const loginWithGoogle = async (credential) => {
    const { data } = await api.post('/auth/google', { credential });
    localStorage.setItem('hs_token', data.accessToken);
    localStorage.setItem('hs_user', JSON.stringify({
      id: data.userId, email: data.email, displayName: data.displayName
    }));
    setUser({ id: data.userId, email: data.email, displayName: data.displayName });
    return data;
  };

  const register = async (email, password, displayName) => {
    const { data } = await api.post('/auth/register', { email, password, displayName });
    localStorage.setItem('hs_token', data.accessToken);
    localStorage.setItem('hs_user', JSON.stringify({
      id: data.userId, email: data.email, displayName: data.displayName
    }));
    setUser({ id: data.userId, email: data.email, displayName: data.displayName });
    return data;
  };

  const logout = () => {
    localStorage.removeItem('hs_token');
    localStorage.removeItem('hs_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loginWithGoogle, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
