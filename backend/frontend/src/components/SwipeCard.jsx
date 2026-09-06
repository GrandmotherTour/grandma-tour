import React, { useRef, useState } from 'react';

export default function SwipeCard({ tag, onAction }) {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);

  const handlePointerDown = (event) => {
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!startX.current) return;
    setOffset(Math.max(-120, Math.min(120, event.clientX - startX.current)));
  };

  const finishSwipe = () => {
    if (offset > 80) onAction('like');
    else if (offset < -80) onAction('dislike');
    setOffset(0);
    startX.current = 0;
  };

  return (
    <article
      className="swipe-card"
      style={{ transform: `translateX(${offset}px) rotate(${offset / 18}deg)` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishSwipe}
      onPointerCancel={finishSwipe}
    >
      <div className={`swipe-image ${tag.key}`} />
      <div className="swipe-content">
        <span className="preference-key">{tag.key}</span>
        <h2>{tag.label}</h2>
        <p>왼쪽으로 넘기면 싫어요, 오른쪽으로 넘기면 좋아요로 기록됩니다.</p>
      </div>
    </article>
  );
}
