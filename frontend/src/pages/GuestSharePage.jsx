import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import { QRCodeSVG } from 'qrcode.react';

export default function GuestSharePage() {
  const { roomCode, memberId } = useParams();
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [customRazorpayKey, setCustomRazorpayKey] = useState('');
  const [simulating, setSimulating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        api.get(`/sessions/${roomCode}`),
        api.get(`/sessions/${roomCode}/members`),
      ]);
      setSession(sRes.data);
      const found = mRes.data.find(m => m.id === parseInt(memberId));
      setMember(found);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [roomCode, memberId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleMarkPaid = async () => {
    setMarking(true);
    try {
      await api.post(`/members/${memberId}/mark-paid`);
      toast.success('Payment marked! Waiting for host confirmation 🎉');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark payment');
    } finally {
      setMarking(false);
    }
  };

  const handleRazorpayPayment = () => {
    const shareAmount = Number(member?.shareAmount || 0);
    if (!shareAmount || shareAmount <= 0) return;

    const activeKey = session?.razorpayKeyId || customRazorpayKey;
    if (!activeKey) {
      toast.error('Razorpay API Key ID is required to open checkout');
      return;
    }

    const options = {
      key: activeKey,
      amount: Math.round(shareAmount * 100),
      currency: "INR",
      name: "SplitTheBill",
      description: `Payment for share in session ${roomCode}`,
      image: "https://cdn-icons-png.flaticon.com/512/2991/2991174.png",
      handler: async function (response) {
        setMarking(true);
        try {
          await api.post(`/members/${memberId}/confirm-razorpay`, {
            razorpayPaymentId: response.razorpay_payment_id
          });
          toast.success('Payment confirmed via Razorpay! 🎉');
          await fetchData();
        } catch (err) {
          toast.error(err.response?.data?.message || 'Verification failed');
        } finally {
          setMarking(false);
        }
      },
      prefill: {
        name: member?.displayName || "Guest",
        email: "guest@splitthebill.com"
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

  const handleSimulatedPayment = async () => {
    setSimulating(true);
    try {
      await api.post(`/members/${memberId}/confirm-razorpay`, {
        razorpayPaymentId: `sim_pay_${Math.random().toString(36).substring(2, 11)}`
      });
      toast.success('Simulated Razorpay payment confirmed successfully! 🧪🎉');
      await fetchData();
    } catch (err) {
      toast.error('Simulation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-spinner" />
    </div>
  );

  const statusConfig = {
    PENDING: { icon: '⏳', color: 'var(--hs-muted)', label: 'Pending', desc: "You haven't transferred yet" },
    MARKED: { icon: '💸', color: 'var(--hs-warning)', label: 'Awaiting Confirmation', desc: 'Waiting for host to confirm your payment' },
    CONFIRMED: { icon: '✅', color: 'var(--hs-success)', label: 'Confirmed!', desc: 'Host confirmed your payment. Thanks!' },
    REJECTED: { icon: '❌', color: 'var(--hs-danger)', label: 'Rejected', desc: 'Host rejected your payment. Please try again.' },
  }[member?.paymentStatus || 'PENDING'];

  const shareAmount = Number(member?.shareAmount || 0);
  const isCollecting = session?.status === 'COLLECTING';

  return (
    <div className="hs-page d-flex align-items-center justify-content-center">
      <div className="hs-container-sm fade-in">
        {/* Session Info */}
        <div className="hs-card mb-4 text-center">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏨</div>
          <h1 style={{ fontWeight: 800, fontSize: '1.4rem', marginBottom: '0.25rem' }}>
            {session?.hotelName}
          </h1>
          {session?.tableNumber && (
            <p className="hs-subtitle">Table {session.tableNumber}</p>
          )}
          <div className="mt-2">
            <span className="hs-badge hs-badge-waiting">{roomCode}</span>
          </div>
        </div>

        {/* Your Share */}
        {isCollecting && shareAmount > 0 ? (
          <div className="hs-card mb-4">
            {member?.isHost ? (
              <div className="text-center py-4">
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👑</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--hs-muted)', marginBottom: '0.5rem' }}>
                  Your share as Host, {member?.displayName}
                </div>
                <div className="hs-amount" style={{ marginBottom: '1.5rem' }}>₹{shareAmount.toFixed(2)}</div>
                
                <div className="hs-card-sm text-start" style={{ background: 'rgba(108, 99, 255, 0.05)', borderRadius: '12px', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--hs-primary)', marginBottom: '0.25rem' }}>
                    Direct Restaurant Settlement
                  </div>
                  <div style={{ color: 'var(--hs-muted)', lineHeight: '1.4' }}>
                    As the host, this is your personal share of the bill. Since you pay the hotel/restaurant the full amount, this share is not sent anywhere. Your guests will pay their shares directly to you.
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div style={{ fontSize: '0.85rem', color: 'var(--hs-muted)', marginBottom: '0.5rem' }}>
                    Your share, {member?.displayName}
                  </div>
                  <div className="hs-amount">₹{shareAmount.toFixed(2)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)', marginTop: '0.5rem' }}>
                    Transfer to: <strong style={{ color: 'var(--hs-text)' }}>{session?.hostName}</strong>
                  </div>
                </div>

                {/* Alert for Rejected Payment */}
                {member?.paymentStatus === 'REJECTED' && (
                  <div className="alert alert-danger text-center p-2 mb-4" style={{ fontSize: '0.8rem', borderRadius: '8px' }}>
                    ⚠️ <strong>Re-payment required:</strong> Host rejected your previous payment attempt.
                  </div>
                )}

                {/* Payment Method Selector */}
                {(member?.paymentStatus === 'PENDING' || member?.paymentStatus === 'REJECTED') && (
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
                      📱 Direct UPI QR
                    </button>
                  </div>
                )}

                {/* Payment Content */}
                {(member?.paymentStatus === 'PENDING' || member?.paymentStatus === 'REJECTED') && (
                  <>
                    {paymentMethod === 'razorpay' ? (
                      <div className="text-center my-3">
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💳</div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--hs-text)' }}>
                          ⚡ Automatic Payment Detection
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                          Scan the dynamic QR code inside the Razorpay checkout from any UPI app on another phone, or pay via cards/netbanking. The payment is **automatically detected and confirmed instantly** (no manual action required).
                        </div>

                        {session?.razorpayKeyId ? (
                          <div className="mb-3">
                            <span className="badge bg-success mb-3" style={{ fontSize: '0.75rem' }}>
                              ✓ Host Razorpay Key Registered ({session.razorpayKeyId})
                            </span>
                            <button
                              className="btn-hs-primary w-100 py-3"
                              onClick={handleRazorpayPayment}
                              disabled={marking}
                              id="razorpay-btn"
                            >
                              {marking ? 'Processing...' : `⚡ Pay ₹${shareAmount.toFixed(2)} via Razorpay`}
                            </button>
                          </div>
                        ) : (
                          <div className="hs-card-sm text-start mb-3" style={{ background: 'rgba(108, 99, 255, 0.05)', borderRadius: '12px' }}>
                            <div style={{ fontWeight: 600, color: 'var(--hs-primary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                              🧪 Simulation Mode Active
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginBottom: '1rem' }}>
                              Host hasn't set their Razorpay Key ID. You can test the payment flow using our simulator or temporarily provide a Key ID below.
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
                                  onClick={handleRazorpayPayment}
                                  disabled={marking}
                                >
                                  Pay ₹{shareAmount.toFixed(2)} via Real Checkout
                                </button>
                              )}
                              <button
                                className="btn-hs-success w-100 py-2"
                                style={{ fontSize: '0.85rem' }}
                                onClick={handleSimulatedPayment}
                                disabled={simulating}
                                id="simulate-razorpay-btn"
                              >
                                {simulating ? 'Simulating...' : `🧪 Simulate Payment Success (No Key)`}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center my-3">
                        {session?.hostUpiId ? (
                          <div className="d-flex flex-column align-items-center gap-2">
                            <div style={{
                              background: '#fff',
                              padding: '12px',
                              borderRadius: '12px',
                              border: '1.5px solid var(--hs-border)',
                              display: 'inline-block'
                            }}>
                              <QRCodeSVG 
                                value={`upi://pay?pa=${session.hostUpiId}&pn=${encodeURIComponent(session.hostName || '')}&am=${shareAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Room ${roomCode}`)}`} 
                                size={150} 
                                level="M" 
                              />
                            </div>
                            <span className="badge bg-secondary" style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>{session.hostUpiId}</span>
                            <a
                              href={`upi://pay?pa=${session.hostUpiId}&pn=${encodeURIComponent(session.hostName || '')}&am=${shareAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Room ${roomCode}`)}`}
                              className="btn-hs-outline d-inline-flex align-items-center gap-2 mt-2 px-4 py-2 text-decoration-none"
                              style={{ fontSize: '0.85rem' }}
                            >
                              📱 Pay via UPI App
                            </a>
                            
                            <div className="hs-divider w-100" />
                            
                            <button
                              className="btn-hs-primary w-100 py-3"
                              onClick={handleMarkPaid}
                              disabled={marking}
                              id="mark-paid-btn"
                            >
                              {marking ? 'Marking...' : `💸 Transferred ₹${shareAmount.toFixed(2)}`}
                            </button>
                          </div>
                        ) : (
                          <div className="hs-card-sm text-center my-3" style={{ background: 'rgba(255, 74, 74, 0.08)', border: '1px solid rgba(255, 74, 74, 0.2)', padding: '12px', borderRadius: '8px' }}>
                            <div style={{ color: 'var(--hs-danger)', fontWeight: 600, fontSize: '0.85rem' }}>
                              ⚠️ Host UPI ID not registered
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--hs-muted)', marginTop: '0.25rem' }}>
                              Host has not registered a UPI ID. Please use **Razorpay** to pay instantly!
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Status Card for MARKED and CONFIRMED */}
                {(member?.paymentStatus === 'MARKED' || member?.paymentStatus === 'CONFIRMED') && (
                  <div className="my-3 text-center">
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{statusConfig.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: statusConfig.color }}>
                      {statusConfig.label}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--hs-muted)', marginBottom: '1.5rem' }}>
                      {statusConfig.desc}
                    </div>
                    
                    {member?.paymentStatus === 'MARKED' && (
                      <div className="hs-card-sm text-center" style={{
                        background: 'rgba(255,201,74,0.1)',
                        border: '1px solid rgba(255,201,74,0.3)',
                      }}>
                        <div style={{ color: 'var(--hs-warning)', fontWeight: 600, fontSize: '0.9rem' }}>
                          ⏳ Waiting for {session?.hostName} to confirm…
                        </div>
                      </div>
                    )}

                    {member?.paymentStatus === 'CONFIRMED' && (
                      <div className="hs-card-sm text-center" style={{
                        background: 'rgba(72,213,151,0.1)',
                        border: '1px solid rgba(72,213,151,0.3)',
                      }}>
                        <div style={{ color: 'var(--hs-success)', fontWeight: 700, fontSize: '1.1rem' }}>
                          ✅ All done! Enjoy your meal!
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="hs-card text-center py-4">
            {session?.status === 'WAITING' && (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <h3>Session hasn't started yet</h3>
                <p style={{ color: 'var(--hs-muted)' }}>Wait for the host to start the session</p>
              </>
            )}
            {session?.status === 'ACTIVE' && (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍽️</div>
                <h3>Ordering Phase</h3>
                <p style={{ color: 'var(--hs-muted)' }}>Wait for the host to close and calculate your share</p>
              </>
            )}
            {session?.status === 'GRACE_PERIOD' && (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                <h3>Grace Period</h3>
                <p style={{ color: 'var(--hs-muted)' }}>Final items being added. Your share will appear soon</p>
              </>
            )}
            {session?.status === 'SETTLED' && (
              <>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</div>
                <h3>Session Settled!</h3>
                <p style={{ color: 'var(--hs-muted)' }}>This session has been fully settled. Hope you enjoyed!</p>
              </>
            )}
          </div>
        )}

        <p className="text-center mt-3" style={{ fontSize: '0.75rem', color: 'var(--hs-muted)' }}>
          SplitTheBill · Room {roomCode} · Auto-refreshing every 5s
        </p>
      </div>
    </div>
  );
}
