import React from 'react';

export default function SwipeActions({ onAction }) {
  return (
    <div className="swipe-actions">
      <button type="button" className="action-button dislike" onClick={() => onAction('dislike')}>
        싫어요
      </button>
      <button type="button" className="action-button skip" onClick={() => onAction('skip')}>
        Skip
      </button>
      <button type="button" className="action-button like" onClick={() => onAction('like')}>
        좋아요
      </button>
    </div>
  );
}
