import { useEffect, useRef } from 'react';

const COLORS = ['#10b981','#34d399','#fbbf24','#60a5fa','#a78bfa','#f87171','#fb923c','#c084fc','#38bdf8','#4ade80'];

export default function Confetti({ active, onDone }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    timerRef.current = setTimeout(() => onDone?.(), 3400);
    return () => clearTimeout(timerRef.current);
  }, [active, onDone]);

  if (!active) return null;

  const particles = Array.from({ length: 90 }, (_, i) => ({
    id: i,
    x: (i * 137.508) % 100,
    delay: (i * 0.035) % 1.5,
    duration: 2.2 + (i % 6) * 0.3,
    color: COLORS[i % COLORS.length],
    w: 6 + (i % 4) * 2,
    h: 4 + (i % 3),
  }));

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      <style>{`@keyframes confettiFall {
        0%   { transform: translateY(-20px) rotate(0deg) scaleX(1); opacity: 1; }
        50%  { transform: translateY(50vh)  rotate(270deg) scaleX(-1); opacity: 1; }
        100% { transform: translateY(110vh) rotate(540deg) scaleX(1); opacity: 0; }
      }`}</style>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.w,
            height: p.h,
            background: p.color,
            borderRadius: 2,
            animation: `confettiFall ${p.duration}s ease-in ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  );
}
