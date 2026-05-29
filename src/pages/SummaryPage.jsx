import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

export default function SummaryPage() {
  const { roomCode } = useParams();
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/sessions/${roomCode}`),
      api.get(`/sessions/${roomCode}/members`),
      api.get(`/sessions/${roomCode}/items`),
    ]).then(([sRes, mRes, iRes]) => {
      setSession(sRes.data);
      setMembers(mRes.data);
      setItems(iRes.data);
    }).catch(() => toast.error('Failed to load summary'))
    .finally(() => setLoading(false));
  }, [roomCode]);

  if (loading) return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-spinner" />
    </div>
  );

  const subtotal = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const taxAmount = subtotal * (Number(session?.taxPercent || 0) / 100);
  const withTax = subtotal + taxAmount;
  const tipAmount = withTax * (Number(session?.tipPercent || 0) / 100);
  const total = withTax + tipAmount;
  const displayMembers = session?.includeHost ? members : members.filter(m => !m.isHost);

  const handlePrint = () => window.print();

  return (
    <div className="hs-page">
      <div className="hs-container fade-in">
        {/* Settlement Banner */}
        <div className="hs-card text-center mb-4" style={{
          background: 'linear-gradient(135deg, rgba(72,213,151,0.15), rgba(108,99,255,0.15))',
          border: '1px solid rgba(72,213,151,0.3)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
          <h1 className="hs-title">Session Settled!</h1>
          <p className="hs-subtitle">{session?.hotelName} · {roomCode}</p>
          <div className="mt-2">
            <span className="hs-badge hs-badge-confirmed">✅ Fully Settled</span>
          </div>
        </div>

        <div className="row g-4">
          {/* Left — Bill Summary */}
          <div className="col-md-6">
            <div className="hs-card h-100">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.5rem',
                color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                📋 Bill Summary
              </h3>

              {/* Items */}
              <div className="d-flex flex-column gap-2 mb-4">
                {items.map(item => (
                  <div key={item.id} className="d-flex justify-content-between align-items-start">
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.itemName}</div>
                      {item.assignedMemberNames?.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>
                          → {item.assignedMemberNames.join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 600 }}>₹{Number(item.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="hs-divider" />

              {/* Totals */}
              <div className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between">
                  <span style={{ color: 'var(--hs-muted)' }}>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="d-flex justify-content-between">
                    <span style={{ color: 'var(--hs-muted)' }}>Tax ({session?.taxPercent}%)</span>
                    <span>₹{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {tipAmount > 0 && (
                  <div className="d-flex justify-content-between">
                    <span style={{ color: 'var(--hs-muted)' }}>Tip ({session?.tipPercent}%)</span>
                    <span>₹{tipAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="hs-divider" style={{ margin: '0.5rem 0' }} />
                <div className="d-flex justify-content-between align-items-center">
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Total</span>
                  <span className="hs-amount" style={{ fontSize: '1.8rem' }}>₹{total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Member Shares */}
          <div className="col-md-6">
            <div className="hs-card h-100">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1.5rem',
                color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                👥 Member Shares
              </h3>
              <div className="d-flex flex-column gap-3">
                {displayMembers.map(member => (
                  <div key={member.id} className="hs-card-sm d-flex align-items-center gap-3">
                    <div className="member-avatar">
                      {member.displayName[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{member.displayName}</div>
                      <span className="hs-badge hs-badge-confirmed" style={{ fontSize: '0.65rem' }}>✅ Paid</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--hs-success)' }}>
                      ₹{Number(member.shareAmount || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hs-divider" />

              {/* Session Meta */}
              <div style={{ fontSize: '0.85rem', color: 'var(--hs-muted)' }}>
                <div className="row g-1">
                  <div className="col-6">Split: <strong style={{ color: 'var(--hs-text)' }}>{session?.splitType}</strong></div>
                  <div className="col-6">Host: <strong style={{ color: 'var(--hs-text)' }}>{session?.hostName}</strong></div>
                  <div className="col-6">Members: <strong style={{ color: 'var(--hs-text)' }}>{members.length}</strong></div>
                  <div className="col-6">Items: <strong style={{ color: 'var(--hs-text)' }}>{items.length}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="hs-card mt-4 d-flex gap-3 justify-content-center flex-wrap">
          <button className="btn-hs-primary px-4 py-2" onClick={handlePrint}>
            🖨️ Print / Save as PDF
          </button>
          <Link to="/dashboard" className="btn-hs-outline px-4 py-2 text-decoration-none">
            ← Back to Dashboard
          </Link>
          <Link to="/create-session" className="btn-hs-outline px-4 py-2 text-decoration-none">
            + New Session
          </Link>
        </div>
      </div>
    </div>
  );
}
