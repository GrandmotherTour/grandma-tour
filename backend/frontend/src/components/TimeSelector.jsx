import React from 'react';

export default function TimeSelector({ value, error, onChange }) {
  return (
    <div className="field-group">
      <label htmlFor="nextScheduleTime">다음 일정 시간</label>
      <input
        id="nextScheduleTime"
        className={error ? 'input is-invalid' : 'input'}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
