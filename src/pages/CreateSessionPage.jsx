import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';

const SPLIT_TYPES = [
  { value: 'EQUAL', label: 'Equal Split', desc: 'Everyone pays the same amount', icon: '⚖️' },
  { value: 'ITEMWISE', label: 'Item-wise Split', desc: 'Pay only for what you ordered', icon: '🍽️' },
  { value: 'PERCENTAGE', label: 'Percentage Split', desc: 'Custom % per person', icon: '📊' },
];

export default function CreateSessionPage() {
  const [form, setForm] = useState({
    hotelName: '',
    tableNumber: '',
    splitType: 'EQUAL',
    currency: 'INR',
    taxPercent: 0,
    tipPercent: 0,
    durationMinutes: 120,
    hostUpiId: '',
    includeHost: true,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/sessions', form);
      toast.success(`Session ${data.roomCode} created! 🎉`);
      navigate(`/session/${data.roomCode}/waiting`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hs-page">
      <div className="hs-container-sm fade-in">
        <div className="mb-4">
          <h1 className="hs-title">New Session</h1>
          <p className="hs-subtitle">Set up your hotel bill splitting session</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Hotel Info */}
          <div className="hs-card mb-4">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '1rem',
              color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              🏨 Hotel Info
            </h3>

            <div className="hs-form-group">
              <label className="hs-label">Hotel / Restaurant Name *</label>
              <input
                type="text"
                className="hs-input"
                placeholder="The Grand Hotel"
                value={form.hotelName}
                onChange={e => setForm(f => ({ ...f, hotelName: e.target.value }))}
                required
                id="hotel-name"
              />
            </div>

            <div className="row g-3">
              <div className="col-6">
                <div className="hs-form-group mb-0">
                  <label className="hs-label">Table Number</label>
                  <input
                    type="text"
                    className="hs-input"
                    placeholder="7"
                    value={form.tableNumber}
                    onChange={e => setForm(f => ({ ...f, tableNumber: e.target.value }))}
                    id="table-number"
                  />
                </div>
              </div>
              <div className="col-6">
                <div className="hs-form-group mb-0">
                  <label className="hs-label">Duration</label>
                  <select
                    className="hs-select"
                    value={form.durationMinutes}
                    onChange={e => setForm(f => ({ ...f, durationMinutes: Number(e.target.value) }))}
                    id="duration"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Split Type */}
          <div className="hs-card mb-4">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '1rem',
              color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              💰 Split Type
            </h3>
            <div className="d-flex flex-column gap-2">
              {SPLIT_TYPES.map(type => (
                <div
                  key={type.value}
                  className="hs-card-sm d-flex align-items-center gap-3"
                  style={{
                    cursor: 'pointer',
                    border: form.splitType === type.value
                      ? '1.5px solid var(--hs-primary)'
                      : '1px solid var(--hs-border)',
                    background: form.splitType === type.value
                      ? 'rgba(108, 99, 255, 0.08)'
                      : 'var(--hs-surface2)',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setForm(f => ({ ...f, splitType: type.value }))}
                >
                  <div style={{ fontSize: '1.5rem' }}>{type.icon}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{type.label}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)' }}>{type.desc}</div>
                  </div>
                  {form.splitType === type.value && (
                    <div className="ms-auto" style={{ color: 'var(--hs-primary)', fontWeight: 700 }}>✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tax & Tip */}
          <div className="hs-card mb-4">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '1rem',
              color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              📊 Tax & Tip
            </h3>
            <div className="row g-3">
              <div className="col-6">
                <label className="hs-label">Tax %</label>
                <input
                  type="number"
                  className="hs-input"
                  placeholder="0"
                  min="0" max="50" step="0.5"
                  value={form.taxPercent}
                  onChange={e => setForm(f => ({ ...f, taxPercent: Number(e.target.value) }))}
                  id="tax-percent"
                />
              </div>
              <div className="col-6">
                <label className="hs-label">Tip %</label>
                <input
                  type="number"
                  className="hs-input"
                  placeholder="0"
                  min="0" max="50" step="0.5"
                  value={form.tipPercent}
                  onChange={e => setForm(f => ({ ...f, tipPercent: Number(e.target.value) }))}
                  id="tip-percent"
                />
              </div>
            </div>
          </div>

          {/* Host Settings */}
          <div className="hs-card mb-4">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '1rem',
              color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              👤 Host Settings
            </h3>
            <div className="d-flex align-items-center justify-content-between">
              <div style={{ paddingRight: '1rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--hs-text)' }}>Include Host in Split</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                  If enabled, the host pays their own calculated share. Otherwise, the host share is excluded from guest splits.
                </div>
              </div>
              <label className="hs-switch" style={{ flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={form.includeHost}
                  onChange={e => setForm(f => ({ ...f, includeHost: e.target.checked }))}
                  id="include-host-checkbox"
                />
                <span className="hs-slider"></span>
              </label>
            </div>
          </div>

          {/* UPI Settings */}
          <div className="hs-card mb-4">
            <h3 style={{ fontWeight: 700, marginBottom: '1.5rem', fontSize: '1rem',
              color: 'var(--hs-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              💳 UPI Payment Settings
            </h3>
            <div className="hs-form-group">
              <label className="hs-label">Your UPI ID (to receive payments) *</label>
              <input
                type="text"
                className="hs-input"
                placeholder="e.g. nishath@okaxis"
                value={form.hostUpiId}
                onChange={e => setForm(f => ({ ...f, hostUpiId: e.target.value }))}
                required
                id="host-upi-id"
              />
              <small style={{ color: 'var(--hs-muted)', display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                Guests will pay their split directly to this UPI address using generated QR codes.
              </small>
            </div>
          </div>

          <button
            type="submit"
            className="btn-hs-primary w-100 py-3"
            disabled={loading}
            id="create-session-submit"
          >
            {loading ? 'Creating Session...' : '🚀 Create Session & Get Room Code'}
          </button>
        </form>
      </div>
    </div>
  );
}
