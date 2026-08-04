import React, { useRef, useEffect, useState, useCallback } from 'react';

const SEGMENT_COLORS = [
  '#6C63FF', '#FF6B6B', '#48D597', '#FFC94A', '#a78bfa',
  '#38bdf8', '#fb923c', '#34d399', '#f472b6', '#60a5fa',
];

function drawWheel(canvas, members, highlightIndex = -1, currentAngle = 0) {
  if (!canvas || members.length === 0) return;
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 10;
  const arc = (2 * Math.PI) / members.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw shadow glow
  ctx.save();
  ctx.shadowBlur = 30;
  ctx.shadowColor = 'rgba(108, 99, 255, 0.4)';

  members.forEach((name, i) => {
    const startAngle = currentAngle + i * arc;
    const endAngle = startAngle + arc;
    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    const isHighlighted = i === highlightIndex;

    // Segment
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, isHighlighted ? radius + 8 : radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isHighlighted ? color : color + 'CC';
    ctx.fill();
    ctx.strokeStyle = '#0F0E1A';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.min(14, 80 / members.length)}px Inter, sans-serif`;
    ctx.shadowBlur = 0;
    const label = name.length > 10 ? name.slice(0, 9) + '…' : name;
    ctx.fillText(label, radius - 12, 4);
    ctx.restore();
  });

  ctx.restore();

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
  ctx.fillStyle = '#0F0E1A';
  ctx.fill();
  ctx.strokeStyle = 'rgba(108,99,255,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎡', cx, cy);

  // Pointer arrow at top
  ctx.beginPath();
  ctx.moveTo(cx - 10, 5);
  ctx.lineTo(cx + 10, 5);
  ctx.lineTo(cx, 28);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
}

export default function SpinnerWheel({ members, onSpinComplete, disabled }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const angleRef = useRef(0);

  useEffect(() => {
    drawWheel(canvasRef.current, members, -1, angleRef.current);
  }, [members]);

  const animateSpin = useCallback((targetIndex, durationMs = 4000) => {
    const arc = (2 * Math.PI) / members.length;
    // The winning segment should end up at the top (angle = -π/2 after normalize)
    const winnerAngle = -(targetIndex * arc + arc / 2) - Math.PI / 2;
    // Add several full rotations for drama
    const totalRotation = Math.PI * 2 * (8 + Math.random() * 4) + winnerAngle - angleRef.current;
    const startAngle = angleRef.current;
    const startTime = performance.now();

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentAngle = startAngle + totalRotation * eased;
      angleRef.current = currentAngle;

      // Determine which segment is at the top
      const normalizedAngle = ((currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const topAngle = (2 * Math.PI - normalizedAngle + 2 * Math.PI) % (2 * Math.PI);
      const highlight = Math.floor(topAngle / arc) % members.length;

      drawWheel(canvasRef.current, members, highlight, currentAngle);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        setWinner(members[targetIndex]);
        onSpinComplete && onSpinComplete(members[targetIndex], targetIndex);
      }
    };

    animRef.current = requestAnimationFrame(tick);
  }, [members, onSpinComplete]);

  const handleSpin = (spinResult) => {
    if (spinning || !spinResult) return;
    setSpinning(true);
    setWinner(null);
    animateSpin(spinResult.winnerIndex);
  };

  // Expose spin trigger via ref
  useEffect(() => {
    canvasRef.current._triggerSpin = handleSpin;
  }, [handleSpin]);

  return (
    <div className="text-center">
      <canvas
        ref={canvasRef}
        width={380}
        height={380}
        style={{ maxWidth: '100%', filter: spinning ? 'drop-shadow(0 0 20px rgba(108,99,255,0.6))' : 'none',
          transition: 'filter 0.3s ease' }}
      />
      {winner && (
        <div className="fade-in mt-3">
          <div style={{
            background: 'rgba(108,99,255,0.15)',
            border: '1px solid rgba(108,99,255,0.4)',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            display: 'inline-block',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--hs-primary)' }}>{winner}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--hs-muted)' }}>is the lucky winner!</div>
          </div>
        </div>
      )}
    </div>
  );
}
