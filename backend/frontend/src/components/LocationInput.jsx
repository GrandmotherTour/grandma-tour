import React from 'react';

export default function LocationInput({ id, label, value, error, onChange, placeholder }) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="field-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={error ? 'input is-invalid' : 'input'}
        value={value.name}
        onChange={(event) => update({ name: event.target.value })}
        placeholder={placeholder}
      />
      <div className="coordinate-row">
        <input
          aria-label={`${label} 위도`}
          className="input coordinate-input"
          type="number"
          step="0.000001"
          value={value.lat}
          onChange={(event) => update({ lat: Number(event.target.value) })}
        />
        <input
          aria-label={`${label} 경도`}
          className="input coordinate-input"
          type="number"
          step="0.000001"
          value={value.lng}
          onChange={(event) => update({ lng: Number(event.target.value) })}
        />
      </div>
      <p className="field-hint">좌표는 임시 기본값을 사용하며, 장소 검색 연결 시 자동 입력으로 교체할 수 있습니다.</p>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
