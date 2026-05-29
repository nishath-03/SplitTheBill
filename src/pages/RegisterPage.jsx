import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
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
              toast.success('Welcome to SplitTheBill! 🎉');
              navigate('/dashboard');
            } catch (err) {
              toast.error(err.response?.data?.message || 'Google Sign-Up failed');
            } finally {
              setLoading(false);
            }
          }
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signup-btn"),
          { theme: "outline", size: "large", width: "100%", text: "signup_with" }
        );
      } catch (err) {
        console.error("Failed to render Google button:", err);
      }
    }
  }, [googleClientId, loginWithGoogle, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await register(form.email, form.password, form.displayName);
      toast.success('Account created! Welcome to SplitTheBill! 🎉');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-container-sm fade-in">
        <div className="hs-card">
          <div className="text-center mb-4">
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✨</div>
            <h1 className="hs-title" style={{ fontSize: '1.8rem' }}>Create Account</h1>
            <p className="hs-subtitle">Start splitting hotel bills with friends</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="hs-form-group">
              <label className="hs-label">Display Name</label>
              <input
                type="text"
                className="hs-input"
                placeholder="Raj Kumar"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                required minLength={2} maxLength={50}
                id="reg-name"
              />
            </div>

            <div className="hs-form-group">
              <label className="hs-label">Email</label>
              <input
                type="email"
                className="hs-input"
                placeholder="your@email.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                id="reg-email"
              />
            </div>

            <div className="hs-form-group">
              <label className="hs-label">Password</label>
              <input
                type="password"
                className="hs-input"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required minLength={6}
                id="reg-password"
              />
            </div>

            <button
              type="submit"
              className="btn-hs-primary w-100"
              disabled={loading}
              id="reg-submit"
            >
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>
          </form>

          {/* Google Sign Up */}
          <div className="mt-3">
            {!googleClientId ? (
              <div className="alert alert-warning text-center p-2" style={{ fontSize: '0.8rem', borderRadius: '8px', background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.25)', color: 'var(--hs-warning)' }}>
                ℹ️ Configure <strong>VITE_GOOGLE_CLIENT_ID</strong> in `.env.local` to enable Google Sign-Up.
              </div>
            ) : (
              <div id="google-signup-btn" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}></div>
            )}
          </div>

          <div className="hs-divider" />
          <p className="text-center mb-0" style={{ color: 'var(--hs-muted)', fontSize: '0.9rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--hs-primary)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
