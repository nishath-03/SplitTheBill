import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function JoinPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Load session info on mount
  React.useEffect(() => {
    api.get(`/sessions/${roomCode}`)
      .then(res => setSession(res.data))
      .catch(() => toast.error('Session not found'))
      .finally(() => setSessionLoaded(true));
  }, [roomCode]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post(`/sessions/${roomCode}/join`, { displayName });
      // Store guest info in session storage
      sessionStorage.setItem(`guest_${roomCode}`, JSON.stringify({
        memberId: data.memberId,
        displayName: data.displayName,
        guestToken: data.guestToken,
      }));
      toast.success(`Joined as ${data.displayName}! 🎉`);
      navigate(`/guest/${roomCode}/${data.memberId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join session');
      setLoading(false);
    }
  };

  if (!sessionLoaded) return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-spinner" />
    </div>
  );

  if (!session) return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-card text-center">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😕</div>
        <h2>Session Not Found</h2>
        <p style={{ color: 'var(--hs-muted)' }}>The room code {roomCode} doesn't exist</p>
      </div>
    </div>
  );

  if (session.status === 'SETTLED') return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-card text-center">
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h2>Session Settled</h2>
        <p style={{ color: 'var(--hs-muted)' }}>This session has already been settled</p>
      </div>
    </div>
  );

  return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-container-sm fade-in">
        <div className="hs-card">
          {/* Hotel Info Header */}
          <div className="text-center mb-4">
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏨</div>
            <h1 className="hs-title" style={{ fontSize: '1.6rem' }}>{session.hotelName}</h1>
            {session.tableNumber && (
              <p className="hs-subtitle">Table {session.tableNumber}</p>
            )}
            <div className="d-flex align-items-center justify-content-center gap-2 mt-2">
              <span className="hs-badge hs-badge-waiting">Code: {roomCode}</span>
              <span className="hs-badge hs-badge-active">{session.status}</span>
            </div>
          </div>

          <div className="hs-divider" />

          {/* Session Info */}
          <div className="hs-card-sm mb-4" style={{ fontSize: '0.85rem' }}>
            <div className="row g-2">
              <div className="col-6">
                <span style={{ color: 'var(--hs-muted)' }}>Split: </span>
                <strong>{session.splitType}</strong>
              </div>
              <div className="col-6">
                <span style={{ color: 'var(--hs-muted)' }}>Host: </span>
                <strong>{session.hostName}</strong>
              </div>
              {session.taxPercent > 0 && (
                <div className="col-6">
                  <span style={{ color: 'var(--hs-muted)' }}>Tax: </span>
                  <strong>{session.taxPercent}%</strong>
                </div>
              )}
              {session.tipPercent > 0 && (
                <div className="col-6">
                  <span style={{ color: 'var(--hs-muted)' }}>Tip: </span>
                  <strong>{session.tipPercent}%</strong>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleJoin}>
            <div className="hs-form-group">
              <label className="hs-label">Your Name</label>
              <input
                type="text"
                className="hs-input"
                placeholder="Enter your display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required minLength={2} maxLength={50}
                autoFocus
                id="join-name"
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginTop: '0.5rem' }}>
                This name will be visible to all session members
              </div>
            </div>

            <button
              type="submit"
              className="btn-hs-primary w-100 py-3"
              disabled={loading}
              id="join-submit"
            >
              {loading ? 'Joining...' : '🎉 Join Session'}
            </button>
          </form>

          <p className="text-center mt-3 mb-0" style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>
            No account needed · Your browser is your identity
          </p>
        </div>
      </div>
    </div>
  );
}
