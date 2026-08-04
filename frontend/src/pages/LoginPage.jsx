import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    /* global google */
    if (googleClientId && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            setLoading(true);
            try {
              await loginWithGoogle(response.credential);
              toast.success('Welcome back! 🏨');
              navigate('/dashboard');
            } catch (err) {
              toast.error(err.response?.data?.message || 'Google Sign-In failed');
            } finally {
              setLoading(false);
            }
          }
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { theme: "outline", size: "large", width: "100%", text: "signin_with" }
        );
      } catch (err) {
        console.error("Failed to render Google button:", err);
      }
    }
  }, [googleClientId, loginWithGoogle, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back! 🏨');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-container-sm fade-in">
        <div className="hs-card">
          <div className="text-center mb-4">
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏨</div>
            <h1 className="hs-title" style={{ fontSize: '1.8rem' }}>Welcome Back</h1>
            <p className="hs-subtitle">Sign in to manage your bill sessions</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="hs-form-group">
              <label className="hs-label">Email</label>
              <input
                type="email"
                className="hs-input"
                placeholder="your@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                id="login-email"
              />
            </div>

            <div className="hs-form-group">
              <label className="hs-label">Password</label>
              <input
                type="password"
                className="hs-input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                id="login-password"
              />
            </div>

            <button
              type="submit"
              className="btn-hs-primary w-100"
              disabled={loading}
              id="login-submit"
            >
              {loading ? (
                <span className="d-flex align-items-center justify-content-center gap-2">
                  <div className="hs-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                  Signing in...
                </span>
              ) : 'Sign In →'}
            </button>
          </form>

          {/* Google Sign In */}
          <div className="mt-3">
            {!googleClientId ? (
              <div className="alert alert-warning text-center p-2" style={{ fontSize: '0.8rem', borderRadius: '8px', background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.25)', color: 'var(--hs-warning)' }}>
                ℹ️ Configure <strong>VITE_GOOGLE_CLIENT_ID</strong> in `.env.local` to enable Google Sign-In.
              </div>
            ) : (
              <div id="google-signin-btn" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
            )}
          </div>

          <div className="hs-divider" />
          <p className="text-center mb-0" style={{ color: 'var(--hs-muted)', fontSize: '0.9rem' }}>
            New here?{' '}
            <Link to="/register" style={{ color: 'var(--hs-primary)', fontWeight: 600 }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
