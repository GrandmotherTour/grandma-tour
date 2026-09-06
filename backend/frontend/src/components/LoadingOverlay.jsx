import React from 'react';

export default function LoadingOverlay({ message = '자투리 시간을 분석하고 있어요.' }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <div className="spinner" />
      <h2>{message}</h2>
      <p>현재 위치와 다음 일정 사이에서 가능한 코스를 찾고 있습니다.</p>
    </div>
  );
}
