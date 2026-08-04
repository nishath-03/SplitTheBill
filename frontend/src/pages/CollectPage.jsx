import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import jsQR from 'jsqr';

const STATUS_CONFIG = {
  PENDING:   { label: 'Pending',   cls: 'hs-badge-pending',   icon: '⏳' },
  MARKED:    { label: 'Marked',    cls: 'hs-badge-marked',    icon: '💸' },
  CONFIRMED: { label: 'Confirmed', cls: 'hs-badge-confirmed', icon: '✅' },
  REJECTED:  { label: 'Rejected',  cls: 'hs-badge-rejected',  icon: '❌' },
};

export default function CollectPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [session, setSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [hotelUpiId, setHotelUpiId] = useState('');
  const [hotelMerchantName, setHotelMerchantName] = useState('');
  const [manualUpiId, setManualUpiId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [scanning, setScanning] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const [customRazorpayKey, setCustomRazorpayKey] = useState('');
  const [simulatingRazorpay, setSimulatingRazorpay] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [mRes, sRes] = await Promise.all([
        api.get(`/sessions/${roomCode}/members`),
        api.get(`/sessions/${roomCode}`),
      ]);
      setMembers(mRes.data);
      setSession(sRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [roomCode]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    let active = true;
    let streamObj = null;

    const runScanner = async () => {
      if (!scanning) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        streamObj = stream;
        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", true);
          videoRef.current.play();
          
          const scanFrame = () => {
            if (!active || !videoRef.current || !canvasRef.current) return;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code) {
                let data = code.data;
                if (data.startsWith('upi://')) {
                  const qs = data.split('?')[1];
                  if (qs) {
                    const searchParams = new URLSearchParams(qs);
                    const pa = searchParams.get('pa');
                    const pn = searchParams.get('pn');
                    if (pa) {
                      setHotelUpiId(pa);
                      if (pn) setHotelMerchantName(decodeURIComponent(pn));
                      toast.success('Successfully scanned Hotel UPI QR code! 🎉');
                      cleanup();
                      return;
                    }
                  }
                }
              }
            }
            requestAnimationFrame(scanFrame);
          };
          requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.error(err);
        toast.error("Camera access failed: " + err.message);
        setScanning(false);
      }
    };

    const cleanup = () => {
      active = false;
      setScanning(false);
      if (streamObj) {
        streamObj.getTracks().forEach(track => track.stop());
      }
      setVideoStream(null);
    };

    if (scanning) {
      runScanner();
    }

    return () => {
      cleanup();
    };
  }, [scanning]);

  const nonHostMembers = members.filter(m => !m.isHost);
  const confirmed = nonHostMembers.filter(m => m.paymentStatus === 'CONFIRMED').length;
  const allConfirmed = confirmed === nonHostMembers.length && nonHostMembers.length > 0;

  const handleConfirm = async (memberId) => {
    try {
      await api.post(`/members/${memberId}/confirm`);
      await fetchData();
      toast.success('Payment confirmed! ✅');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm');
    }
  };

  const handleReject = async (memberId) => {
    try {
      await api.post(`/members/${memberId}/reject`);
      await fetchData();
      toast.info('Payment rejected — member needs to pay again');
    } catch (err) {
      toast.error('Failed to reject');
    }
  };

  const handleSettle = async () => {
    setSettling(true);
    try {
      await api.post(`/sessions/${roomCode}/settle`);
      toast.success('🎉 Session settled! All paid!');
      navigate(`/session/${roomCode}/summary`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Not all payments confirmed yet');
      setSettling(false);
    }
  };

  const handleRazorpayHotelPayment = () => {
    if (!totalBillAmount || totalBillAmount <= 0) return;

    const activeKey = session?.razorpayKeyId || customRazorpayKey;
    if (!activeKey) {
      toast.error('Razorpay API Key ID is required to open checkout');
      return;
    }

    const options = {
      key: activeKey,
      amount: Math.round(totalBillAmount * 100),
      currency: "INR",
      name: "SplitTheBill",
      description: `Final Settlement for ${session?.hotelName || 'Hotel'} - Session ${roomCode}`,
      image: "https://cdn-icons-png.flaticon.com/512/2991/2991174.png",
      handler: async function (response) {
        setSettling(true);
        try {
          await api.post(`/sessions/${roomCode}/settle`);
          toast.success('🎉 Session settled via Razorpay! 🏨');
          navigate(`/session/${roomCode}/summary`);
        } catch (err) {
          toast.error(err.response?.data?.message || 'Settlement failed');
          setSettling(false);
        }
      },
      prefill: {
        name: session?.hostName || "Host",
        email: "host@splitthebill.com"
      },
      theme: {
        color: "#6c5ce7"
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      toast.error('Payment failed: ' + response.error.description);
    });
    rzp.open();
  };

  const handleSimulatedSettle = async () => {
    setSimulatingRazorpay(true);
    try {
      await api.post(`/sessions/${roomCode}/settle`);
      toast.success('Simulated Razorpay hotel settlement successful! 🧪🎉');
      navigate(`/session/${roomCode}/summary`);
    } catch (err) {
      toast.error('Simulation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSimulatingRazorpay(false);
    }
  };

  const totalCollected = nonHostMembers
    .filter(m => m.paymentStatus === 'CONFIRMED')
    .reduce((sum, m) => sum + Number(m.shareAmount || 0), 0);

  const totalExpected = nonHostMembers.reduce((sum, m) => sum + Number(m.shareAmount || 0), 0);

  const subtotal = session?.totalAmount || 0;
  const taxAmount = subtotal * (Number(session?.taxPercent || 0) / 100);
  const withTax = subtotal + taxAmount;
  const tipAmount = withTax * (Number(session?.tipPercent || 0) / 100);
  const totalBillAmount = withTax + tipAmount;

  const activeUpiId = hotelUpiId || manualUpiId;
  const hotelUpiUrl = activeUpiId
    ? `upi://pay?pa=${activeUpiId}&pn=${encodeURIComponent(hotelMerchantName || session?.hotelName || 'Hotel')}&am=${totalBillAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Room ${roomCode}`)}`
    : '';

  if (loading) return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-spinner" />
    </div>
  );

  return (
    <div className="hs-page">
      <div className="hs-container fade-in">
        {/* Header */}
        <div className="mb-4">
          <h1 className="hs-title" style={{ fontSize: '1.5rem' }}>💰 Collect Payments</h1>
          <p className="hs-subtitle">{session?.hotelName} · {roomCode}</p>
        </div>

        {/* Progress */}
        <div className="hs-card mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>Collection Progress</h3>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--hs-success)' }}>
              {confirmed}/{nonHostMembers.length} Paid
            </span>
          </div>
          <div className="hs-timer-bar mb-3">
            <div className="hs-timer-fill"
              style={{ width: `${nonHostMembers.length > 0 ? (confirmed / nonHostMembers.length) * 100 : 0}%`,
                background: allConfirmed ? 'linear-gradient(90deg, var(--hs-success), #2db37a)' : undefined }} />
          </div>
          <div className="row g-3">
            <div className="col-4 text-center">
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--hs-success)' }}>
                ₹{totalCollected.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>Collected</div>
            </div>
            <div className="col-4 text-center">
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--hs-primary)' }}>
                ₹{totalExpected.toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>Total Due</div>
            </div>
            <div className="col-4 text-center">
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--hs-warning)' }}>
                ₹{(totalExpected - totalCollected).toFixed(2)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>Remaining</div>
            </div>
          </div>
        </div>

        {/* Member Payment Cards */}
        <div className="d-flex flex-column gap-3 mb-4">
          {nonHostMembers.map(member => {
            const statusConfig = STATUS_CONFIG[member.paymentStatus] || STATUS_CONFIG.PENDING;
            return (
              <div key={member.id} className="hs-card" style={{ padding: '1.25rem' }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="member-avatar">
                    {member.displayName[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{member.displayName}</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--hs-success)' }}>
                      ₹{Number(member.shareAmount || 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="d-flex flex-column align-items-end gap-2">
                    <span className={`hs-badge ${statusConfig.cls}`}>
                      {statusConfig.icon} {statusConfig.label}
                    </span>
                    {member.paymentStatus === 'MARKED' && (
                      <div className="d-flex gap-2">
                        <button
                          className="btn-hs-success px-3 py-1"
                          style={{ fontSize: '0.8rem' }}
                          onClick={() => handleConfirm(member.id)}
                          id={`confirm-${member.id}`}
                        >
                          ✅ Confirm
                        </button>
                        <button
                          className="btn-hs-danger px-3 py-1"
                          style={{ fontSize: '0.8rem' }}
                          onClick={() => handleReject(member.id)}
                          id={`reject-${member.id}`}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Settle Button */}
        <div className="hs-card text-center">
          {allConfirmed ? (
            <>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</div>
              <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>All payments confirmed!</h3>
              <p style={{ color: 'var(--hs-muted)', marginBottom: '1.5rem' }}>
                Now pay the hotel and mark session as settled
              </p>
              <button
                className="btn-hs-success px-5 py-3"
                onClick={() => setShowPaymentModal(true)}
                id="settle-btn"
                style={{ fontSize: '1.1rem' }}
              >
                🏨 Pay Hotel & Settle Session
              </button>
            </>
          ) : (
            <>
              <div style={{ color: 'var(--hs-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                Waiting for all members to pay…
              </div>
              <button
                className="btn-hs-success px-5 py-3"
                disabled
                style={{ opacity: 0.5, fontSize: '1.1rem' }}
              >
                🏨 Pay Hotel & Settle Session
              </button>
              <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginTop: '0.5rem' }}>
                {nonHostMembers.length - confirmed} payment(s) still pending
              </div>
            </>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="hs-modal-backdrop" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050
          }}>
            <div className="hs-card p-4 mx-3" style={{ maxWidth: '480px', width: '100%', zIndex: 1060 }}>
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h3 style={{ fontWeight: 800, margin: 0, fontSize: '1.25rem' }}>🏨 Pay the Hotel</h3>
                <button
                  type="button"
                  className="btn-close"
                  style={{ background: 'none', border: 'none', color: 'var(--hs-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
                  onClick={() => setShowPaymentModal(false)}
                >
                  ×
                </button>
              </div>

              <p style={{ color: 'var(--hs-muted)', fontSize: '0.85rem' }} className="mb-4">
                Choose your payment method to settle the full hotel bill of <strong style={{ color: 'var(--hs-success)' }}>₹{totalBillAmount.toFixed(2)}</strong>.
              </p>

              {/* Payment Selector Tabs */}
              <div className="d-flex p-1 mb-4" style={{
                background: 'var(--hs-surface2)',
                borderRadius: '12px',
                border: '1px solid var(--hs-border)'
              }}>
                <button
                  type="button"
                  className="flex-grow-1 py-2 px-3 rounded-3"
                  style={{
                    background: paymentMethod === 'razorpay' ? 'linear-gradient(135deg, var(--hs-primary), var(--hs-primary-dark))' : 'transparent',
                    color: paymentMethod === 'razorpay' ? '#fff' : 'var(--hs-muted)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s ease',
                    boxShadow: paymentMethod === 'razorpay' ? '0 4px 12px rgba(108, 99, 255, 0.3)' : 'none'
                  }}
                  onClick={() => setPaymentMethod('razorpay')}
                >
                  ⚡ Razorpay (In Dev)
                </button>
                <button
                  type="button"
                  className="flex-grow-1 py-2 px-3 rounded-3"
                  style={{
                    background: paymentMethod === 'upi' ? 'linear-gradient(135deg, var(--hs-primary), var(--hs-primary-dark))' : 'transparent',
                    color: paymentMethod === 'upi' ? '#fff' : 'var(--hs-muted)',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s ease',
                    boxShadow: paymentMethod === 'upi' ? '0 4px 12px rgba(108, 99, 255, 0.3)' : 'none'
                  }}
                  onClick={() => setPaymentMethod('upi')}
                >
                  📱 Hotel UPI QR
                </button>
              </div>

              {paymentMethod === 'razorpay' ? (
                <div className="text-center my-3">
                  <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💳</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--hs-text)' }}>
                    Instant Settle via Razorpay
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                    Scan code or pay via cards/netbanking. Settle the room instantly on completion.
                  </div>

                  {session?.razorpayKeyId ? (
                    <div className="mb-3">
                      <span className="badge bg-success mb-3" style={{ fontSize: '0.75rem' }}>
                        ✓ Razorpay Key Registered ({session.razorpayKeyId})
                      </span>
                      <button
                        className="btn-hs-primary w-100 py-3"
                        onClick={handleRazorpayHotelPayment}
                        disabled={settling}
                        id="razorpay-hotel-btn"
                      >
                        {settling ? 'Settling...' : `⚡ Pay ₹${totalBillAmount.toFixed(2)} via Razorpay`}
                      </button>
                    </div>
                  ) : (
                    <div className="hs-card-sm text-start mb-3" style={{ background: 'rgba(108, 99, 255, 0.05)', borderRadius: '12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--hs-primary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        🧪 Simulation Mode Active
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginBottom: '1rem' }}>
                        No Razorpay Key configured. You can test the checkout using our simulator or temporarily provide a Key ID below.
                      </div>

                      {/* Custom Key input */}
                      <div className="hs-form-group mb-3">
                        <label className="hs-label" style={{ fontSize: '0.7rem' }}>Option A: Enter Custom Key ID (rzp_test_...)</label>
                        <input
                          type="text"
                          className="hs-input py-1"
                          style={{ fontSize: '0.8rem' }}
                          placeholder="Enter Key to try real checkout"
                          value={customRazorpayKey}
                          onChange={(e) => setCustomRazorpayKey(e.target.value)}
                        />
                      </div>

                      <div className="d-flex flex-column gap-2">
                        {customRazorpayKey.trim() && (
                          <button
                            className="btn-hs-primary w-100 py-2"
                            style={{ fontSize: '0.85rem' }}
                            onClick={handleRazorpayHotelPayment}
                            disabled={settling}
                          >
                            Pay ₹{totalBillAmount.toFixed(2)} via Real Checkout
                          </button>
                        )}
                        <button
                          className="btn-hs-success w-100 py-2"
                          style={{ fontSize: '0.85rem' }}
                          onClick={handleSimulatedSettle}
                          disabled={simulatingRazorpay}
                          id="simulate-settle-btn"
                        >
                          {simulatingRazorpay ? 'Simulating...' : `🧪 Simulate Settle Success (No Key)`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Scan QR */}
                  <div className="hs-form-group mb-3">
                    <label className="hs-label">Option 1: Scan Hotel Standee QR</label>
                    
                    {scanning && (
                      <div className="position-relative overflow-hidden mb-3" style={{
                        width: '100%',
                        maxWidth: '320px',
                        height: '240px',
                        margin: '0 auto',
                        borderRadius: '12px',
                        border: '2px solid var(--hs-primary)',
                        background: '#000',
                        boxShadow: '0 0 20px rgba(108, 99, 255, 0.4)'
                      }}>
                        {/* Live video feed */}
                        <video
                          ref={videoRef}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Canvas used internally for scanning */}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        
                        {/* Red Scanning line animation */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '2px',
                          background: 'linear-gradient(90deg, transparent, #ff4a4a, transparent)',
                          boxShadow: '0 0 8px #ff4a4a',
                          animation: 'scan-line 2s linear infinite'
                        }} />
                        
                        {/* Viewfinder frame overlay */}
                        <div style={{
                          position: 'absolute',
                          top: '10%',
                          left: '10%',
                          width: '80%',
                          height: '80%',
                          border: '2px dashed rgba(255, 255, 255, 0.5)',
                          borderRadius: '8px',
                          pointerEvents: 'none'
                        }} />
                      </div>
                    )}

                    {scanning ? (
                      <button
                        type="button"
                        className="btn-hs-danger w-100 py-2 mb-2"
                        onClick={() => setScanning(false)}
                        style={{ fontSize: '0.85rem' }}
                      >
                        Cancel Camera Scan
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-hs-outline w-100 py-3 d-flex align-items-center justify-content-center gap-2"
                        onClick={() => setScanning(true)}
                        style={{ fontSize: '0.9rem', borderWidth: '2px' }}
                      >
                        📷 Scan Hotel QR Code
                      </button>
                    )}
                  </div>

                  <div className="text-center my-2" style={{ color: 'var(--hs-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    — OR —
                  </div>

                  {/* Manual UPI */}
                  <div className="hs-form-group mb-3">
                    <label className="hs-label">Option 2: Enter Hotel UPI ID</label>
                    <input
                      type="text"
                      className="hs-input"
                      placeholder="e.g. hotelname@okaxis"
                      value={manualUpiId}
                      onChange={(e) => {
                        setManualUpiId(e.target.value);
                        setHotelUpiId(''); // override uploaded
                      }}
                    />
                  </div>

                  {activeUpiId && (
                    <div className="hs-card-sm text-center mb-3" style={{ background: 'rgba(72,213,151,0.08)', border: '1px solid rgba(72,213,151,0.2)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>PAYMENT DESTINATION</div>
                      <strong style={{ color: 'var(--hs-success)', fontSize: '0.9rem' }}>{activeUpiId}</strong>
                      {hotelMerchantName && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--hs-text)', fontWeight: 600 }}>({hotelMerchantName})</div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="d-flex flex-column gap-2 mt-4">
                    {hotelUpiUrl ? (
                      <a
                        href={hotelUpiUrl}
                        className="btn-hs-primary w-100 py-3 text-center text-decoration-none"
                        style={{ fontSize: '1.05rem', fontWeight: 700 }}
                      >
                        📱 Launch UPI App to Pay ₹{totalBillAmount.toFixed(2)}
                      </a>
                    ) : (
                      <button
                        className="btn-hs-primary w-100 py-3"
                        disabled
                        style={{ opacity: 0.5, fontSize: '1.05rem', fontWeight: 700 }}
                      >
                        Enter UPI details to start payment
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn-hs-success w-100 py-3"
                      onClick={handleSettle}
                      disabled={settling}
                    >
                      {settling ? 'Settling Room...' : '✅ I have Paid! Mark Room as Settled'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
