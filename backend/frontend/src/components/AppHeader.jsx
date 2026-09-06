import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const steps = [
  { path: '/', label: '조건' },
  { path: '/preference', label: '취향' },
  { path: '/result', label: '결과' },
];

export default function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeIndex = Math.max(0, steps.findIndex((step) => step.path === location.pathname));

  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={() => navigate('/')}>
        <span className="brand-mark">J</span>
        <span>
          <strong>JATURIP</strong>
          <small>자투리 시간 추천</small>
        </span>
      </button>
      <nav className="step-nav" aria-label="서비스 단계">
        {steps.map((step, index) => (
          <span key={step.path} className={`step-chip ${index <= activeIndex ? 'is-active' : ''}`}>
            {step.label}
          </span>
        ))}
      </nav>
    </header>
  );
}
