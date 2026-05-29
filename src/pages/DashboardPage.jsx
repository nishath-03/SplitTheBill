import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const STATUS_LABELS = {
  WAITING: { label: 'Waiting', cls: 'hs-badge-waiting' },
  ACTIVE: { label: 'Active', cls: 'hs-badge-active' },
  GRACE_PERIOD: { label: 'Grace Period', cls: 'hs-badge-marked' },
  COLLECTING: { label: 'Collecting', cls: 'hs-badge-marked' },
  SETTLED: { label: 'Settled', cls: 'hs-badge-settled' },
};

function getSessionRoute(session) {
  switch (session.status) {
    case 'WAITING': return `/session/${session.roomCode}/waiting`;
    case 'ACTIVE': return `/session/${session.roomCode}/active`;
    case 'GRACE_PERIOD': return `/session/${session.roomCode}/active`;
    case 'COLLECTING': return `/session/${session.roomCode}/collect`;
    case 'SETTLED': return `/session/${session.roomCode}/summary`;
    default: return `/session/${session.roomCode}/waiting`;
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/sessions/my')
      .then(res => setSessions(res.data))
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  const activeSessions = sessions.filter(s => s.status !== 'SETTLED');
  const pastSessions = sessions.filter(s => s.status === 'SETTLED');

  return (
    <div className="hs-page">
      <div className="hs-container">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-4 fade-in">
          <div>
            <h1 className="hs-title mb-1">Dashboard</h1>
            <p className="hs-subtitle">Welcome back, {user?.displayName}!</p>
          </div>
          <Link to="/create-session" className="btn-hs-primary text-decoration-none px-4 py-2">
            + New Session
          </Link>
        </div>

        {/* Stats Row */}
        <div className="row g-3 mb-4 fade-in">
          {[
            { label: 'Total Sessions', value: sessions.length, icon: '🏨' },
            { label: 'Active', value: activeSessions.length, icon: '⚡' },
            { label: 'Settled', value: pastSessions.length, icon: '✅' },
          ].map(stat => (
            <div key={stat.label} className="col-4">
              <div className="hs-card text-center" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--hs-primary)' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)' }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="hs-spinner mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="hs-card text-center py-5 fade-in">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🍽️</div>
            <h3 style={{ color: 'var(--hs-text)' }}>No sessions yet</h3>
            <p className="hs-subtitle mb-4">Create your first SplitTheBill session to get started</p>
            <Link to="/create-session" className="btn-hs-primary text-decoration-none px-4 py-2">
              Create Your First Session
            </Link>
          </div>
        ) : (
          <>
            {activeSessions.length > 0 && (
              <div className="mb-4 fade-in">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--hs-muted)',
                  textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
                  Active Sessions
                </h2>
                <div className="d-flex flex-column gap-3">
                  {activeSessions.map(session => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </div>
            )}

            {pastSessions.length > 0 && (
              <div className="fade-in">
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--hs-muted)',
                  textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem' }}>
                  Past Sessions
                </h2>
                <div className="d-flex flex-column gap-3">
                  {pastSessions.map(session => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const navigate = useNavigate();
  const statusInfo = STATUS_LABELS[session.status] || { label: session.status, cls: 'hs-badge-pending' };

  return (
    <div
      className="hs-card"
      style={{ cursor: 'pointer', padding: '1.25rem 1.5rem' }}
      onClick={() => navigate(getSessionRoute(session))}
    >
      <div className="d-flex align-items-center justify-content-between">
        <div className="d-flex align-items-center gap-3">
          <div className="member-avatar" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
            🏨
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{session.hotelName}</div>
            <div style={{ color: 'var(--hs-muted)', fontSize: '0.85rem' }}>
              Code: <span className="room-code-display" style={{ fontSize: '1rem', letterSpacing: '0.2rem' }}>
                {session.roomCode}
              </span>
              {session.tableNumber && ` · Table ${session.tableNumber}`}
            </div>
          </div>
        </div>
        <div className="d-flex flex-column align-items-end gap-2">
          <span className={`hs-badge ${statusInfo.cls}`}>{statusInfo.label}</span>
          {session.totalAmount > 0 && (
            <span style={{ fontWeight: 700, color: 'var(--hs-success)', fontSize: '0.95rem' }}>
              ₹{Number(session.totalAmount).toFixed(2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
