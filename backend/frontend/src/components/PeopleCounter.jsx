import React from 'react';

export default function PeopleCounter({ value, onChange }) {
  return (
    <div className="field-group">
      <label>인원수</label>
      <div className="counter">
        <button type="button" aria-label="인원수 감소" onClick={() => onChange(Math.max(1, value - 1))}>
          -
        </button>
        <strong>{value}명</strong>
        <button type="button" aria-label="인원수 증가" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}
