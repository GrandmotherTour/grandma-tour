import React from 'react';

const presets = [
  { label: '2시간', value: 120 },
  { label: '3시간', value: 180 },
  { label: '4시간', value: 240 },
];

export default function AvailableTimeSelector({ value, error, onChange }) {
  const isCustom = !presets.some((preset) => preset.value === value);

  return (
    <div className="field-group">
      <label>코스에 쓸 수 있는 시간</label>
      <div className="segmented-grid">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`segment-button ${value === preset.value ? 'is-selected' : ''}`}
            onClick={() => onChange(preset.value)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className={`segment-button ${isCustom ? 'is-selected' : ''}`}
          onClick={() => onChange(value || 150)}
        >
          직접입력
        </button>
      </div>
      <input
        className="input"
        type="range"
        min="60"
        max="360"
        step="30"
        value={value || 180}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="range-value">{Math.floor((value || 0) / 60)}시간 {(value || 0) % 60 ? `${(value || 0) % 60}분` : ''}</div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
