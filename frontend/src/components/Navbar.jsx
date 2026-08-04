import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="hs-navbar d-flex align-items-center justify-content-between">
      <Link to={user ? '/dashboard' : '/login'} className="hs-logo text-decoration-none">
        💸 SplitTheBill
      </Link>

      {user ? (
        <div className="d-flex align-items-center gap-3">
          <span style={{ color: 'var(--hs-muted)', fontSize: '0.9rem' }}>
            Hi, <strong style={{ color: 'var(--hs-text)' }}>{user.displayName}</strong>
          </span>
          <Link to="/create-session" className="btn-hs-primary px-3 py-2 text-decoration-none"
            style={{ fontSize: '0.85rem', borderRadius: '8px' }}>
            + New Session
          </Link>
          <button
            onClick={handleLogout}
            className="btn-hs-outline px-3 py-2"
            style={{ fontSize: '0.85rem', borderRadius: '8px' }}
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="d-flex gap-2">
          <Link to="/login" className="btn-hs-outline px-3 py-2 text-decoration-none"
            style={{ fontSize: '0.85rem', borderRadius: '8px' }}>
            Login
          </Link>
          <Link to="/register" className="btn-hs-primary px-3 py-2 text-decoration-none"
            style={{ fontSize: '0.85rem', borderRadius: '8px' }}>
            Register
          </Link>
        </div>
      )}
    </nav>
  );
}
