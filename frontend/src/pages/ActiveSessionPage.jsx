import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import SpinnerWheel from '../components/SpinnerWheel';
import { runOCR, parseReceiptText } from '../utils/receiptOCR';

export default function ActiveSessionPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [members, setMembers] = useState([]);
  const [items, setItems] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showSpinner, setShowSpinner] = useState(false);
  const [spinReason, setSpinReason] = useState('Who pays the tip?');
  const [spinResult, setSpinResult] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const spinWheelRef = useRef(null);

  // New item form
  const [newItem, setNewItem] = useState({ itemName: '', amount: '', description: '', assignedMemberIds: [] });
  const [addingItem, setAddingItem] = useState(false);

  // Scan Bill States
  const [showScanModal, setShowScanModal] = useState(false);
  const [billImage, setBillImage] = useState(null);
  const [scanningBill, setScanningBill] = useState(false);
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const fileInputRef = useRef(null);
  const [entryMethod, setEntryMethod] = useState('scan');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('splitbill_gemini_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedItems, setExtractedItems] = useState([]);
  const [showReview, setShowReview] = useState(false);
  const [addingItems, setAddingItems] = useState(false);

  const openScanModal = () => {
    setBillImage(null);
    setScanningBill(false);
    setShowScanModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (event) => {
      setBillImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerCapture = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleScanWithAI = async () => {
    if (!billImage) return;
    if (!geminiApiKey.trim()) {
      toast.warn('Please enter a Gemini API key above to use AI scanning.', { autoClose: 4000 });
      return;
    }
    setScanningBill(true);
    setOcrProgress(50);

    try {
      localStorage.setItem('splitbill_gemini_key', geminiApiKey.trim());
      const base64Data = billImage.split(',')[1];
      
      const res = await api.post(`/sessions/${roomCode}/items/scan-bill`, {
        image: base64Data,
        mimeType: imageMimeType,
        geminiApiKey: geminiApiKey.trim()
      }, { timeout: 60000 });

      const parsed = res.data.map(item => ({
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        itemName: String(item.itemName || '').trim(),
        amount: typeof item.amount === 'number' ? item.amount : parseFloat(item.amount) || 0
      })).filter(it => it.itemName && it.amount > 0);

      setOcrProgress(100);

      if (parsed.length === 0) {
        toast.warn('No items detected by AI. Try a clearer photo.');
      } else {
        toast.info(`🤖 AI found ${parsed.length} items`, { autoClose: 2000 });
        setExtractedItems(parsed);
        setShowReview(true);
      }
    } catch (aiErr) {
      const errMsg = aiErr.response?.data?.message || aiErr.message || 'Unknown API Error';
      toast.error(`AI Vision failed: ${errMsg}`, { autoClose: 6000 });
      console.error("Gemini API Error:", aiErr);
    } finally {
      setScanningBill(false);
      setTimeout(() => setOcrProgress(0), 1000);
    }
  };

  const handleScanWithOCR = async () => {
    if (!billImage) return;
    setScanningBill(true);
    setOcrProgress(0);

    try {
      const rawText = await runOCR(billImage, setOcrProgress);
      const parsed = parseReceiptText(rawText);

      if (parsed.length === 0) {
        toast.warn('No items detected by OCR. Try a clearer, well-lit photo.');
      } else {
        toast.info(`📄 OCR found ${parsed.length} items`, { autoClose: 2000 });
        setExtractedItems(parsed);
        setShowReview(true);
      }
    } catch (err) {
      toast.error('Local OCR failed. Please try again.');
      console.error("OCR Error:", err);
    } finally {
      setScanningBill(false);
      setTimeout(() => setOcrProgress(0), 1000);
    }
  };

  const handleAddReviewedItems = async () => {
    if (extractedItems.length === 0) return;
    setAddingItems(true);
    let added = 0;
    for (const item of extractedItems) {
      try {
        await api.post(`/sessions/${roomCode}/items`, {
          itemName: item.itemName,
          amount: item.amount
        });
        added++;
      } catch (_) { /* skip bad items */ }
    }
    toast.success(`Added ${added} item${added !== 1 ? 's' : ''} to the session! 🎉`);
    setShowReview(false);
    setShowScanModal(false);
    setExtractedItems([]);
    setBillImage(null);
    await fetchAll();
    setAddingItems(false);
  };

  const updateReviewItem = (id, field, value) => {
    setExtractedItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
  };

  const removeReviewItem = (id) => {
    setExtractedItems(prev => prev.filter(it => it.id !== id));
  };

  const fetchAll = useCallback(async () => {
    try {
      const [sRes, mRes, iRes] = await Promise.all([
        api.get(`/sessions/${roomCode}`),
        api.get(`/sessions/${roomCode}/members`),
        api.get(`/sessions/${roomCode}/items`),
      ]);
      const sData = sRes.data;
      if (sData.status === 'WAITING') {
        navigate(`/session/${roomCode}/waiting`);
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
      setMembers(mRes.data);
      setItems(iRes.data);

      // Update timer
      if (sData.startedAt && sData.durationMinutes) {
        const started = new Date(sData.startedAt).getTime();
        const endTime = started + sData.durationMinutes * 60000;
        const remaining = Math.max(0, endTime - Date.now());
        setTimeLeft(remaining);
      }
    } catch (err) {
      console.error(err);
    }
  }, [roomCode, navigate]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Local timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;
    const tick = setInterval(() => setTimeLeft(t => Math.max(0, t - 1000)), 1000);
    return () => clearInterval(tick);
  }, [timeLeft]);

  const formatTime = (ms) => {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                 : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const timerPercent = session?.durationMinutes && timeLeft !== null
    ? (timeLeft / (session.durationMinutes * 60000)) * 100
    : 100;

  const handleAddItem = async (e) => {
    e.preventDefault();
    setAddingItem(true);
    try {
      await api.post(`/sessions/${roomCode}/items`, {
        itemName: newItem.itemName,
        amount: parseFloat(newItem.amount),
        description: newItem.description || undefined,
        assignedMemberIds: newItem.assignedMemberIds.length > 0 ? newItem.assignedMemberIds : undefined,
      });
      setNewItem({ itemName: '', amount: '', description: '', assignedMemberIds: [] });
      await fetchAll();
      toast.success('Item added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add item');
    } finally {
      setAddingItem(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await api.delete(`/sessions/${roomCode}/items/${itemId}`);
      await fetchAll();
      toast.success('Item removed');
    } catch (err) {
      toast.error('Failed to delete item');
    }
  };

  const handleSpin = async () => {
    setSpinning(true);
    try {
      const { data } = await api.post(`/sessions/${roomCode}/spin?reason=${encodeURIComponent(spinReason)}`);
      setSpinResult(data);
      // Trigger the canvas animation
      const canvasEl = spinWheelRef.current?.querySelector('canvas');
      if (canvasEl?._triggerSpin) {
        canvasEl._triggerSpin(data);
      }
    } catch (err) {
      toast.error('Failed to spin');
      setSpinning(false);
    }
  };

  const handleCloseSession = async () => {
    if (!window.confirm('Close the ordering phase and enter grace period?')) return;
    try {
      await api.post(`/sessions/${roomCode}/close`);
      toast.info('Grace period started — 5 minutes to add final items');
      await fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to close session');
    }
  };

  const handleCalculate = async () => {
    try {
      await api.post(`/sessions/${roomCode}/calculate`);
      toast.success('Shares calculated! Moving to collection phase');
      navigate(`/session/${roomCode}/collect`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to calculate');
    }
  };

  const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);
  const memberNames = members.map(m => m.displayName);

  return (
    <div className="hs-page">
      <div className="hs-container fade-in">
        {/* Header */}
        <div className="d-flex align-items-start justify-content-between mb-4">
          <div>
            <h1 className="hs-title" style={{ fontSize: '1.5rem' }}>{session?.hotelName}</h1>
            <p className="hs-subtitle">
              {roomCode} {session?.tableNumber && `· Table ${session.tableNumber}`}
            </p>
          </div>
          <div className="d-flex flex-column align-items-end gap-2">
            <span className={`hs-badge ${session?.status === 'GRACE_PERIOD' ? 'hs-badge-marked' : 'hs-badge-active'}`}>
              {session?.status === 'GRACE_PERIOD' ? '⏳ Grace Period' : '⚡ Active'}
            </span>
            {timeLeft !== null && (
              <span style={{ fontSize: '1.5rem', fontWeight: 800,
                color: timerPercent < 20 ? 'var(--hs-danger)' : 'var(--hs-text)' }}>
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>

        {/* Timer bar */}
        {timeLeft !== null && (
          <div className="hs-timer-bar mb-4">
            <div className="hs-timer-fill" style={{ width: `${timerPercent}%`,
              background: timerPercent < 20
                ? 'linear-gradient(90deg, var(--hs-danger), #ff9999)'
                : undefined }} />
          </div>
        )}

        <div className="row g-4">
          {/* Left — Bill Items */}
          <div className="col-md-7">
            {/* Entry Method Selector Tabs */}
            {(session?.status === 'ACTIVE' || session?.status === 'GRACE_PERIOD') && (
              <div className="d-flex p-1 mb-3" style={{
                background: 'var(--hs-surface2)',
                borderRadius: '12px',
                border: '1px solid var(--hs-border)'
              }}>
                <button
                  type="button"
                  className="flex-grow-1 py-2 px-3 rounded-3"
                  style={{
                    background: entryMethod === 'scan' ? 'linear-gradient(135deg, var(--hs-primary), #5b4fe6)' : 'transparent',
                    color: entryMethod === 'scan' ? '#fff' : 'var(--hs-muted)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setEntryMethod('scan')}
                >
                  📷 Scan Bill
                </button>
                <button
                  type="button"
                  className="flex-grow-1 py-2 px-3 rounded-3"
                  style={{
                    background: entryMethod === 'manual' ? 'linear-gradient(135deg, var(--hs-primary), #5b4fe6)' : 'transparent',
                    color: entryMethod === 'manual' ? '#fff' : 'var(--hs-muted)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => setEntryMethod('manual')}
                >
                  ✍️ Manual Entry
                </button>
              </div>
            )}

            {/* Scan Bill CTA Card */}
            {(session?.status === 'ACTIVE' || session?.status === 'GRACE_PERIOD') && entryMethod === 'scan' && (
              <div className="hs-card mb-4 p-4 text-center fade-in" style={{
                background: 'linear-gradient(135deg, rgba(108,99,255,0.05), rgba(108,99,255,0.12))',
                border: '1.5px solid rgba(108,99,255,0.25)',
                boxShadow: '0 8px 32px 0 rgba(108,99,255,0.08)'
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧾✨</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--hs-text)' }}>Quick Scan Bill</h3>
                <p style={{ color: 'var(--hs-muted)', fontSize: '0.85rem', maxWidth: '340px', margin: '0 auto 1.25rem', lineHeight: '1.4' }}>
                  Take a photo of your physical bill or upload an image and dynamically update the page
                </p>
                <button
                  type="button"
                  className="btn-hs-primary w-100 py-3"
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 15px rgba(108,99,255,0.25)'
                  }}
                  onClick={openScanModal}
                >
                  📷 Scan Bill
                </button>
              </div>
            )}

            <div className="hs-card mb-4">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <div className="d-flex align-items-center gap-2">
                  <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>📋 Bill Items</h3>
                </div>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--hs-success)' }}>
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>

              {/* Items List */}
              {items.length === 0 ? (
                <div className="text-center py-3" style={{ color: 'var(--hs-muted)', fontSize: '0.9rem' }}>
                  No items yet — add the first one below
                </div>
              ) : (
                <div className="d-flex flex-column gap-2 mb-3">
                  {items.map(item => (
                    <div key={item.id} className="hs-card-sm d-flex align-items-center gap-2 slide-in">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{item.itemName}</div>
                        {item.addedByName && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>
                            by {item.addedByName}
                            {item.assignedMemberNames?.length > 0 &&
                              ` → ${item.assignedMemberNames.join(', ')}`}
                          </div>
                        )}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--hs-success)' }}>
                        ₹{Number(item.amount).toFixed(2)}
                      </span>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--hs-danger)',
                          cursor: 'pointer', fontSize: '1rem', padding: '0 0.25rem' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Item Form */}
              {entryMethod === 'manual' && (
                <form onSubmit={handleAddItem}>
                  <div className="hs-divider" />
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--hs-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1rem' }}>
                    + Add Item
                  </div>
                  <div className="row g-2">
                    <div className="col-7">
                      <input
                        type="text"
                        className="hs-input"
                        placeholder="Item name"
                        value={newItem.itemName}
                        onChange={e => setNewItem(n => ({ ...n, itemName: e.target.value }))}
                        required
                        id="item-name"
                      />
                    </div>
                    <div className="col-5">
                      <input
                        type="number"
                        className="hs-input"
                        placeholder="₹ Amount"
                        value={newItem.amount}
                        onChange={e => setNewItem(n => ({ ...n, amount: e.target.value }))}
                        min="0.01" step="0.01" required
                        id="item-amount"
                      />
                    </div>
                  </div>

                  {session?.splitType === 'ITEMWISE' && (
                    <div className="mt-2">
                      <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)', marginBottom: '0.5rem' }}>
                        Who ordered this? (leave empty = split equally)
                      </div>
                      <div className="d-flex flex-wrap gap-1">
                        {members.filter(m => session?.includeHost || !m.isHost).map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setNewItem(n => ({
                              ...n,
                              assignedMemberIds: n.assignedMemberIds.includes(m.id)
                                ? n.assignedMemberIds.filter(id => id !== m.id)
                                : [...n.assignedMemberIds, m.id]
                            }))}
                            style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '999px',
                              border: newItem.assignedMemberIds.includes(m.id)
                                ? '1.5px solid var(--hs-primary)'
                                : '1px solid var(--hs-border)',
                              background: newItem.assignedMemberIds.includes(m.id)
                                ? 'rgba(108,99,255,0.15)' : 'transparent',
                              color: 'var(--hs-text)',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            {m.displayName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn-hs-primary w-100 mt-2 py-2"
                    disabled={addingItem}
                    id="add-item-btn"
                    style={{ fontSize: '0.9rem' }}
                  >
                    {addingItem ? 'Adding...' : '+ Add Item'}
                  </button>
                </form>
              )}
            </div>

            {/* Session Actions */}
            <div className="hs-card">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>⚡ Session Actions</h3>
              <div className="d-flex flex-column gap-2">
                {session?.status === 'ACTIVE' && (
                  <button className="btn-hs-danger w-100 py-2" onClick={handleCloseSession}>
                    🔒 Close Ordering Phase
                  </button>
                )}
                {(session?.status === 'GRACE_PERIOD' || session?.status === 'ACTIVE') && (
                  <button className="btn-hs-success w-100 py-2" onClick={handleCalculate}
                    disabled={items.length === 0} id="calculate-btn">
                    🧮 Calculate & Distribute Shares
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right — Members + Spinner */}
          <div className="col-md-5">
            {/* Members */}
            <div className="hs-card mb-4">
              <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>
                👥 Members ({members.length})
              </h3>
              <div className="d-flex flex-column gap-2">
                {members.map(m => (
                  <div key={m.id} className="d-flex align-items-center gap-2">
                    <div className="member-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                      {m.displayName[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: m.isHost ? 700 : 400 }}>
                      {m.displayName}
                    </span>
                    {m.isHost && <span className="hs-badge hs-badge-active ms-auto" style={{ fontSize: '0.65rem' }}>Host</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Spinner Wheel */}
            <div className="hs-card">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>🎡 Spinner Wheel</h3>
                <button
                  className="btn-hs-outline py-1 px-3"
                  style={{ fontSize: '0.8rem' }}
                  onClick={() => setShowSpinner(s => !s)}
                >
                  {showSpinner ? 'Hide' : 'Show'}
                </button>
              </div>

              {showSpinner && memberNames.length > 1 && (
                <div>
                  <div className="hs-form-group">
                    <label className="hs-label">Reason for spinning</label>
                    <input
                      type="text"
                      className="hs-input"
                      value={spinReason}
                      onChange={e => setSpinReason(e.target.value)}
                      placeholder="Who pays the tip?"
                      id="spin-reason"
                    />
                  </div>

                  <div ref={spinWheelRef}>
                    <SpinnerWheel
                      members={memberNames}
                      onSpinComplete={(winnerName) => {
                        setSpinning(false);
                        toast.success(`🎉 ${winnerName} wins: ${spinReason}!`);
                      }}
                    />
                  </div>

                  <button
                    className="btn-hs-primary w-100 mt-3 py-2"
                    onClick={handleSpin}
                    disabled={spinning}
                    id="spin-btn"
                  >
                    {spinning ? '🎡 Spinning...' : '🎡 Spin the Wheel!'}
                  </button>
                </div>
              )}

              {showSpinner && memberNames.length <= 1 && (
                <div className="text-center" style={{ color: 'var(--hs-muted)', fontSize: '0.85rem' }}>
                  Need at least 2 members to spin
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scan Bill Modal */}
        {showScanModal && (
          <div className="hs-modal-backdrop" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050
          }}>
            <div className="hs-card p-4 mx-3" style={{ maxWidth: '480px', width: '100%', zIndex: 1060 }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 style={{ fontWeight: 800, margin: 0, fontSize: '1.25rem' }}>📷 Scan Bill</h3>
                <button
                  type="button"
                  className="btn-close"
                  style={{ background: 'none', border: 'none', color: 'var(--hs-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
                  onClick={() => setShowScanModal(false)}
                >
                  ×
                </button>
              </div>

              <p style={{ color: 'var(--hs-muted)', fontSize: '0.85rem' }} className="mb-3">
                Take a photo of your physical bill or upload an image and dynamically update the page
              </p>

              {/* Gemini API Key Input */}
              <div style={{
                background: 'var(--hs-surface2)',
                border: '1.5px solid var(--hs-border)',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px'
              }}>
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--hs-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    🤖 Gemini API Key
                  </span>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.72rem', color: 'var(--hs-primary)', textDecoration: 'none' }}
                  >
                    Get free key ↗
                  </a>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  <input
                    type={showKeyInput ? 'text' : 'password'}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Paste your Gemini API key here…"
                    style={{
                      flex: 1,
                      background: 'var(--hs-surface)',
                      border: '1px solid var(--hs-border)',
                      borderRadius: '8px',
                      color: 'var(--hs-text)',
                      padding: '7px 10px',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(v => !v)}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--hs-muted)', cursor: 'pointer',
                      fontSize: '1rem', padding: '0 4px'
                    }}
                    title={showKeyInput ? 'Hide' : 'Show'}
                  >
                    {showKeyInput ? '🙈' : '👁️'}
                  </button>
                  {geminiApiKey && (
                    <button
                      type="button"
                      onClick={() => { setGeminiApiKey(''); localStorage.removeItem('splitbill_gemini_key'); }}
                      style={{
                        background: 'none', border: 'none',
                        color: '#e74c3c', cursor: 'pointer',
                        fontSize: '0.9rem', padding: '0 4px'
                      }}
                      title="Clear key"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {geminiApiKey && (
                  <div style={{ fontSize: '0.7rem', color: '#2ecc71', marginTop: '5px' }}>✓ Key saved for this session</div>
                )}
              </div>

              {/* Native Capture Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {billImage ? (
                <div className="text-center mb-4">
                  <div className="position-relative overflow-hidden" style={{
                    width: '100%',
                    maxHeight: '280px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--hs-border)',
                    background: '#000'
                  }}>
                    <img
                      src={billImage}
                      alt="Bill Receipt"
                      style={{ width: '100%', maxHeight: '280px', objectFit: 'contain' }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-hs-outline mt-3 w-100 py-2"
                    onClick={triggerCapture}
                    style={{ fontSize: '0.85rem' }}
                  >
                    🔄 Take Another Photo
                  </button>
                </div>
              ) : (
                <div
                  onClick={triggerCapture}
                  className="d-flex flex-column align-items-center justify-content-center p-5 mb-4"
                  style={{
                    border: '2px dashed var(--hs-border)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    background: 'var(--hs-surface2)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--hs-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--hs-border)'}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧾</div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--hs-text)' }}>
                    Capture or Upload Receipt
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginTop: '0.25rem' }}>
                    Supports camera photos and local image files
                  </div>
                </div>
              )}

              {/* OCR Progress Bar */}
              {scanningBill && !geminiApiKey.trim() && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="d-flex justify-content-between mb-1">
                    <span style={{ fontSize: '0.78rem', color: 'var(--hs-muted)' }}>Reading bill with OCR…</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--hs-primary)', fontWeight: 700 }}>{ocrProgress}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--hs-surface2)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${ocrProgress}%`,
                      background: 'linear-gradient(90deg, var(--hs-primary), #5b4fe6)',
                      borderRadius: '99px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              )}

              {/* Review Step — editable extracted items */}
              {showReview && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--hs-text)' }}>
                      ✅ {extractedItems.length} items found — review before adding
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReview(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--hs-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ← Back
                    </button>
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {extractedItems.map(item => (
                      <div key={item.id} className="d-flex gap-2 align-items-center" style={{
                        background: 'var(--hs-surface2)',
                        borderRadius: '8px',
                        padding: '6px 10px'
                      }}>
                        <input
                          value={item.itemName}
                          onChange={e => updateReviewItem(item.id, 'itemName', e.target.value)}
                          style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--hs-text)',
                            fontSize: '0.85rem',
                            outline: 'none',
                            minWidth: 0
                          }}
                        />
                        <span style={{ color: 'var(--hs-muted)', fontSize: '0.8rem' }}>₹</span>
                        <input
                          type="number"
                          value={item.amount}
                          onChange={e => updateReviewItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                          style={{
                            width: '70px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--hs-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            outline: 'none',
                            textAlign: 'right'
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeReviewItem(item.id)}
                          style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.9rem', flexShrink: 0 }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                  <div className="d-flex flex-column gap-2 mt-3">
                    <button
                      className="btn-hs-primary w-100 py-3 d-flex align-items-center justify-content-center gap-2"
                      onClick={handleAddReviewedItems}
                      disabled={addingItems || extractedItems.length === 0}
                      style={{ fontSize: '1rem', fontWeight: 700 }}
                    >
                      {addingItems ? (
                        <>
                          <div className="hs-spinner" style={{ width: '18px', height: '18px', borderWidth: '2px', borderTopColor: '#fff' }} />
                          Adding items…
                        </>
                      ) : `➕ Add ${extractedItems.length} Item${extractedItems.length !== 1 ? 's' : ''} to Session`}
                    </button>
                    <button
                      type="button"
                      className="btn-hs-outline w-100 py-2"
                      onClick={() => { setShowReview(false); setShowScanModal(false); }}
                      disabled={addingItems}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons (only when not in review mode) */}
              {!showReview && (
                <div className="d-flex flex-column gap-2 mt-2">
                  {billImage ? (
                    <>
                      <button
                        className="btn-hs-primary w-100 py-3 d-flex align-items-center justify-content-center gap-2"
                        onClick={handleScanWithAI}
                        disabled={scanningBill}
                        style={{ fontSize: '1.05rem', fontWeight: 700 }}
                      >
                        {scanningBill ? (
                          <>
                            <div className="hs-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', borderTopColor: '#fff' }} />
                            {`Processing with AI… ${ocrProgress}%`}
                          </>
                        ) : '🤖 Scan with AI'}
                      </button>
                      <button
                        className="btn-hs-outline w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
                        onClick={handleScanWithOCR}
                        disabled={scanningBill}
                        style={{ fontSize: '0.95rem', fontWeight: 600 }}
                      >
                        📄 Scan with Local OCR
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-hs-primary w-100 py-3"
                      onClick={triggerCapture}
                      style={{ fontSize: '1.05rem', fontWeight: 700 }}
                    >
                      📷 Take Photo / Choose File
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-hs-outline w-100 py-2"
                    onClick={() => setShowScanModal(false)}
                    disabled={scanningBill}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
