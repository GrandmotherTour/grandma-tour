import React from 'react';

const options = [
  { label: '도보', value: 'walk' },
  { label: '차량', value: 'car' },
];

export default function TransportSelector({ value, error, onChange }) {
  return (
    <div className="field-group">
      <label>이동방법</label>
      <div className="transport-grid">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`transport-card ${value === option.value ? 'is-selected' : ''}`}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <span>{option.value === 'walk' ? '가까운 동선 중심' : '넓은 반경 탐색'}</span>
          </button>
        ))}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
