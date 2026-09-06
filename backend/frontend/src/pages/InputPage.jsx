import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AvailableTimeSelector from '../components/AvailableTimeSelector.jsx';
import LocationInput from '../components/LocationInput.jsx';
import PeopleCounter from '../components/PeopleCounter.jsx';
import TimeSelector from '../components/TimeSelector.jsx';
import TransportSelector from '../components/TransportSelector.jsx';
import { useJaturip } from '../context/JaturipContext.jsx';

function validate(input) {
  const errors = {};
  if (!input.currentLocation.name.trim()) errors.currentLocation = '현재 위치를 입력해주세요.';
  if (!input.nextScheduleLocation.name.trim()) errors.nextScheduleLocation = '다음 일정 장소를 입력해주세요.';
  if (!input.nextScheduleTime) errors.nextScheduleTime = '다음 일정 시간을 선택해주세요.';
  if (!input.availableMinutes) errors.availableMinutes = '코스에 쓸 수 있는 시간을 선택해주세요.';
  if (!input.peopleCount || input.peopleCount < 1) errors.peopleCount = '인원수는 1명 이상이어야 합니다.';
  if (!input.transportMode) errors.transportMode = '이동방법을 선택해주세요.';
  return errors;
}

export default function InputPage() {
  const navigate = useNavigate();
  const { userInput, updateUserInput, updateLocation, resetFlow } = useJaturip();
  const [errors, setErrors] = useState({});

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = validate(userInput);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    resetFlow();
    navigate('/preference');
  };

  return (
    <form className="page-card input-page" onSubmit={handleSubmit}>
      <div className="page-title">
        <span>Input</span>
        <h1>다음 일정 전, 어디를 들를까요?</h1>
        <p>현재 위치와 다음 일정, 쓸 수 있는 시간을 입력하면 취향 선택 후 코스를 추천합니다.</p>
      </div>

      <div className="form-grid">
        <LocationInput
          id="currentLocation"
          label="현재 위치"
          value={userInput.currentLocation}
          error={errors.currentLocation}
          placeholder="서울 성동구 성수동"
          onChange={(location) => updateLocation('currentLocation', location)}
        />
        <LocationInput
          id="nextScheduleLocation"
          label="다음 일정 장소"
          value={userInput.nextScheduleLocation}
          error={errors.nextScheduleLocation}
          placeholder="잠실역"
          onChange={(location) => updateLocation('nextScheduleLocation', location)}
        />
        <TimeSelector
          value={userInput.nextScheduleTime}
          error={errors.nextScheduleTime}
          onChange={(nextScheduleTime) => updateUserInput({ nextScheduleTime })}
        />
        <AvailableTimeSelector
          value={userInput.availableMinutes}
          error={errors.availableMinutes}
          onChange={(availableMinutes) => updateUserInput({ availableMinutes })}
        />
        <PeopleCounter value={userInput.peopleCount} onChange={(peopleCount) => updateUserInput({ peopleCount })} />
        <TransportSelector
          value={userInput.transportMode}
          error={errors.transportMode}
          onChange={(transportMode) => updateUserInput({ transportMode })}
        />
      </div>

      <div className="button-row">
        <button className="primary-button" type="submit">
          다음
        </button>
      </div>
    </form>
  );
}
