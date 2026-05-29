import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function WaitingRoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const { user } = useAuth();
  const [upiInput, setUpiInput] = useState('');
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [razorpayInput, setRazorpayInput] = useState('');
  const [isEditingRazorpay, setIsEditingRazorpay] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    splitType: 'EQUAL',
    taxPercent: 0,
    tipPercent: 0,
    includeHost: true
  });

  const fetchData = useCallback(async () => {
    try {
      const [sessionRes, membersRes] = await Promise.all([
        api.get(`/sessions/${roomCode}?includeQr=true`),
        api.get(`/sessions/${roomCode}/members`),
      ]);
      const sData = sessionRes.data;
      if (sData.status === 'ACTIVE' || sData.status === 'GRACE_PERIOD') {
        navigate(`/session/${roomCode}/active`);
        return;
      }
      if (sData.status === 'COLLECTING') {
        navigate(`/session/${roomCode}/collect`);
        return;
      }
      if (sData.status === 'SETTLED') {
        navigate(`/session/${roomCode}/summary`);
        return;
      }
      setSession(sData);
      setMembers(membersRes.data);
    } catch (err) {
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [roomCode, navigate]);

  useEffect(() => {
    fetchData();
    // Poll every 3 seconds for new members
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (session) {
      if (!upiInput && session.hostUpiId) {
        setUpiInput(session.hostUpiId);
      }
      if (!razorpayInput && session.razorpayKeyId) {
        setRazorpayInput(session.razorpayKeyId);
      }
    }
  }, [session, upiInput, razorpayInput]);

  useEffect(() => {
    if (session) {
      setConfigForm({
        splitType: session.splitType || 'EQUAL',
        taxPercent: session.taxPercent || 0,
        tipPercent: session.tipPercent || 0,
        includeHost: session.includeHost !== undefined ? session.includeHost : true
      });
    }
  }, [session]);

  const handleSaveUpi = async () => {
    try {
      await api.patch(`/sessions/${roomCode}/tax-tip`, {
        hostUpiId: upiInput
      });
      toast.success('UPI ID updated successfully! 🎉');
      setIsEditingUpi(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to update UPI ID');
    }
  };

  const handleSaveRazorpay = async () => {
    try {
      await api.patch(`/sessions/${roomCode}/tax-tip`, {
        razorpayKeyId: razorpayInput
      });
      toast.success('Razorpay Key updated successfully! 🎉');
      setIsEditingRazorpay(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to update Razorpay Key');
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.patch(`/sessions/${roomCode}/tax-tip`, {
        splitType: configForm.splitType,
        taxPercent: Number(configForm.taxPercent),
        tipPercent: Number(configForm.tipPercent),
        includeHost: configForm.includeHost
      });
      toast.success('Session configuration updated! 🎉');
      setIsEditingConfig(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to update session configuration');
    }
  };

  const handleStart = async () => {
    if (members.length < 2) {
      toast.warning('At least 2 members are needed to start');
      return;
    }
    setStarting(true);
    try {
      await api.post(`/sessions/${roomCode}/start`);
      toast.success('Session started! 🚀');
      navigate(`/session/${roomCode}/active`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start session');
      setStarting(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success('Room code copied!');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${roomCode}`);
    toast.success('Join link copied!');
  };

  if (loading) return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-spinner" />
    </div>
  );

  return (
    <div className="hs-page">
      <div className="hs-container fade-in">
        <div className="row g-4">
          {/* Left — QR + Code */}
          <div className="col-md-5">
            <div className="hs-card text-center h-100">
              <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--hs-muted)',
                textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem' }}>
                📱 Scan to Join
              </h2>

              {session?.qrCodeBase64 ? (
                <img
                  src={session.qrCodeBase64}
                  alt="QR Code"
                  style={{
                    width: '200px', height: '200px',
                    borderRadius: '12px',
                    border: '3px solid var(--hs-border)',
                    padding: '8px',
                    background: '#fff',
                    marginBottom: '1.5rem',
                  }}
                />
              ) : (
                <div style={{ width: '200px', height: '200px', background: 'var(--hs-surface2)',
                  borderRadius: '12px', margin: '0 auto 1.5rem', display: 'flex',
                  alignItems: 'center', justifyContent: 'center' }}>
                  <div className="hs-spinner" />
                </div>
              )}

              <div className="mb-3">
                <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginBottom: '0.5rem' }}>
                  Room Code
                </div>
                <div className="room-code-display" onClick={copyCode} style={{ cursor: 'pointer' }}>
                  {roomCode}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginTop: '0.25rem' }}>
                  Click to copy
                </div>
              </div>

              <div className="hs-divider" />

              <div style={{ fontSize: '0.85rem', color: 'var(--hs-muted)', marginBottom: '1rem' }}>
                {session?.hotelName} {session?.tableNumber && `· Table ${session.tableNumber}`}
              </div>

              <button
                className="btn-hs-outline w-100 py-2"
                onClick={copyLink}
                style={{ fontSize: '0.85rem' }}
              >
                🔗 Copy Join Link
              </button>
            </div>
          </div>

          {/* Right — Members + Actions */}
          <div className="col-md-7">
            <div className="hs-card h-100">
              <div className="d-flex align-items-center justify-content-between mb-4">
                <div>
                  <h1 className="hs-title" style={{ fontSize: '1.5rem' }}>{session?.hotelName}</h1>
                  <p className="hs-subtitle">Waiting for friends to join…</p>
                </div>
                <span className="hs-badge hs-badge-waiting">
                  {members.length} Joined
                </span>
              </div>

              {/* Member List */}
              <div className="d-flex flex-column gap-2 mb-4" style={{ minHeight: '200px' }}>
                {members.length === 0 ? (
                  <div className="text-center py-4" style={{ color: 'var(--hs-muted)' }}>
                    Waiting for the first person to scan…
                  </div>
                ) : (
                  members.map((member, i) => (
                    <div key={member.id} className="hs-card-sm d-flex align-items-center gap-3 slide-in"
                      style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="member-avatar">
                        {member.displayName[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{member.displayName}</div>
                        {member.isHost && (
                          <span className="hs-badge hs-badge-active" style={{ fontSize: '0.65rem' }}>
                            Host
                          </span>
                        )}
                      </div>
                      <div className="ms-auto" style={{ color: 'var(--hs-success)', fontSize: '1.2rem' }}>
                        ✓
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Session Config */}
              {session?.hostId === user?.id && isEditingConfig ? (
                <div className="hs-card-sm mb-4">
                  <div style={{ fontWeight: 600, color: 'var(--hs-muted)', marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    ⚙️ Edit Session Configuration
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-12">
                      <label className="hs-label" style={{ fontSize: '0.75rem' }}>Split Type</label>
                      <select
                        className="hs-select py-1"
                        style={{ fontSize: '0.85rem' }}
                        value={configForm.splitType}
                        onChange={e => setConfigForm(cf => ({ ...cf, splitType: e.target.value }))}
                      >
                        <option value="EQUAL">Equal Split</option>
                        <option value="ITEMWISE">Item-wise Split</option>
                        <option value="PERCENTAGE">Percentage Split</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="hs-label" style={{ fontSize: '0.75rem' }}>Tax %</label>
                      <input
                        type="number"
                        className="hs-input py-1"
                        style={{ fontSize: '0.85rem' }}
                        min="0" max="50" step="0.5"
                        value={configForm.taxPercent}
                        onChange={e => setConfigForm(cf => ({ ...cf, taxPercent: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="hs-label" style={{ fontSize: '0.75rem' }}>Tip %</label>
                      <input
                        type="number"
                        className="hs-input py-1"
                        style={{ fontSize: '0.85rem' }}
                        min="0" max="50" step="0.5"
                        value={configForm.tipPercent}
                        onChange={e => setConfigForm(cf => ({ ...cf, tipPercent: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="col-12 mt-2 d-flex align-items-center justify-content-between">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Include Host in Split</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>Host pays their own share</div>
                      </div>
                      <label className="hs-switch" style={{ flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={configForm.includeHost}
                          onChange={e => setConfigForm(cf => ({ ...cf, includeHost: e.target.checked }))}
                        />
                        <span className="hs-slider"></span>
                      </label>
                    </div>
                  </div>
                  <div className="d-flex gap-2 justify-content-end">
                    <button className="btn-hs-outline px-3 py-1" style={{ fontSize: '0.8rem' }} onClick={() => setIsEditingConfig(false)}>Cancel</button>
                    <button className="btn-hs-success px-3 py-1" style={{ fontSize: '0.8rem' }} onClick={handleSaveConfig}>Save</button>
                  </div>
                </div>
              ) : (
                <div className="hs-card-sm mb-4" style={{ fontSize: '0.85rem' }}>
                  <div className="row align-items-center">
                    <div className="col-8">
                      <div className="row">
                        <div className="col-6">
                          <span style={{ color: 'var(--hs-muted)' }}>Split Type: </span>
                          <strong>{session?.splitType}</strong>
                        </div>
                        <div className="col-6">
                          <span style={{ color: 'var(--hs-muted)' }}>Duration: </span>
                          <strong>{session?.durationMinutes} min</strong>
                        </div>
                        <div className="col-6 mt-1">
                          <span style={{ color: 'var(--hs-muted)' }}>Tax: </span>
                          <strong>{session?.taxPercent}%</strong>
                        </div>
                        <div className="col-6 mt-1">
                          <span style={{ color: 'var(--hs-muted)' }}>Tip: </span>
                          <strong>{session?.tipPercent}%</strong>
                        </div>
                        <div className="col-12 mt-1">
                          <span style={{ color: 'var(--hs-muted)' }}>Include Host: </span>
                          <strong>{session?.includeHost ? 'Yes' : 'No'}</strong>
                        </div>
                      </div>
                    </div>
                    {session?.hostId === user?.id && (
                      <div className="col-4 text-end">
                        <button className="btn-hs-outline px-3 py-1" style={{ fontSize: '0.75rem' }} onClick={() => setIsEditingConfig(true)}>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* UPI ID Setup */}
              <div className="hs-card-sm mb-4" style={{ fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--hs-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  💳 UPI Address Configuration
                </div>
                {session?.hostId === user?.id ? (
                  isEditingUpi ? (
                    <div className="d-flex gap-2">
                      <input
                        type="text"
                        className="hs-input py-1"
                        style={{ fontSize: '0.85rem' }}
                        value={upiInput}
                        onChange={(e) => setUpiInput(e.target.value)}
                        placeholder="yourname@okaxis"
                      />
                      <button className="btn-hs-success px-3 py-1" onClick={handleSaveUpi} style={{ fontSize: '0.85rem' }}>Save</button>
                      <button className="btn-hs-outline px-3 py-1" onClick={() => setIsEditingUpi(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        {session?.hostUpiId ? (
                          <span>UPI ID: <strong style={{ color: 'var(--hs-success)' }}>{session.hostUpiId}</strong></span>
                        ) : (
                          <span style={{ color: 'var(--hs-danger)', fontWeight: 600 }}>⚠️ No UPI ID registered</span>
                        )}
                      </div>
                      <button className="btn-hs-outline px-3 py-1" onClick={() => setIsEditingUpi(true)} style={{ fontSize: '0.75rem' }}>
                        Edit
                      </button>
                    </div>
                  )
                ) : (
                  <div>
                    {session?.hostUpiId ? (
                      <span>Host UPI ID: <strong>{session.hostUpiId}</strong></span>
                    ) : (
                      <span style={{ color: 'var(--hs-warning)' }}>⏳ Host hasn't set up their UPI ID yet</span>
                    )}
                  </div>
                )}
              </div>

              {/* Razorpay Key Setup */}
              <div className="hs-card-sm mb-4" style={{ fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--hs-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  ⚡ Razorpay Configuration
                </div>
                {session?.hostId === user?.id ? (
                  isEditingRazorpay ? (
                    <div className="d-flex gap-2">
                      <input
                        type="text"
                        className="hs-input py-1"
                        style={{ fontSize: '0.85rem' }}
                        value={razorpayInput}
                        onChange={(e) => setRazorpayInput(e.target.value)}
                        placeholder="rzp_test_..."
                      />
                      <button className="btn-hs-success px-3 py-1" onClick={handleSaveRazorpay} style={{ fontSize: '0.85rem' }}>Save</button>
                      <button className="btn-hs-outline px-3 py-1" onClick={() => setIsEditingRazorpay(false)} style={{ fontSize: '0.85rem' }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        {session?.razorpayKeyId ? (
                          <span>Key ID: <strong style={{ color: 'var(--hs-primary)' }}>{session.razorpayKeyId}</strong></span>
                        ) : (
                          <span style={{ color: 'var(--hs-muted)' }}>No Razorpay Key registered (Simulation active)</span>
                        )}
                      </div>
                      <button className="btn-hs-outline px-3 py-1" onClick={() => setIsEditingRazorpay(true)} style={{ fontSize: '0.75rem' }}>
                        Edit
                      </button>
                    </div>
                  )
                ) : (
                  <div>
                    {session?.razorpayKeyId ? (
                      <span>Host Razorpay Key: <strong>{session.razorpayKeyId}</strong></span>
                    ) : (
                      <span style={{ color: 'var(--hs-muted)' }}>Using simulation mode (no host key registered)</span>
                    )}
                  </div>
                )}
              </div>

              <button
                className="btn-hs-success w-100 py-3"
                onClick={handleStart}
                disabled={starting || members.length < 2}
                id="start-session-btn"
              >
                {starting ? 'Starting...' : `🚀 Start Session (${members.length} members)`}
              </button>

              {members.length < 2 && (
                <p className="text-center mt-2" style={{ color: 'var(--hs-muted)', fontSize: '0.8rem' }}>
                  Need at least 1 more person to start
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
