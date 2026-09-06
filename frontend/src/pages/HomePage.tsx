import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LocationPicker from '../components/LocationPicker';
import { placeApi } from '../api/placeApi';
import { resetRecommendation, tripStore, updateTripStore } from '../store/tripStore';
import type { NextSchedule, TransportMode, TripLocation } from '../types/recommendation';

type Errors = Partial<Record<'currentLocation' | 'nextScheduleName' | 'nextScheduleTime', string>>;

const validate = (currentLocation: TripLocation | null, nextSchedule: NextSchedule): Errors => {
  const errors: Errors = {};

  if (!currentLocation) errors.currentLocation = '현재 위치를 선택해주세요.';
  if (!nextSchedule.name.trim()) errors.nextScheduleName = '다음 일정 장소를 입력해주세요.';
  if (!nextSchedule.time) errors.nextScheduleTime = '다음 일정 시간을 선택해주세요.';

  return errors;
};

const HomePage = () => {
  const navigate = useNavigate();
  const [currentLocation, setCurrentLocation] = useState<TripLocation | null>(tripStore.currentLocation);
  const [nextSchedule, setNextSchedule] = useState<NextSchedule>(tripStore.nextSchedule);
  const [partySize, setPartySize] = useState(tripStore.partySize);
  const [transportMode, setTransportMode] = useState<TransportMode>(tripStore.transportMode);
  const [errors, setErrors] = useState<Errors>({});
  const [searchingSchedule, setSearchingSchedule] = useState(false);

  const searchNextSchedule = async () => {
    if (!nextSchedule.name.trim()) return nextSchedule;

    setSearchingSchedule(true);
    try {
      const result = await placeApi.getPlaces(nextSchedule.name, currentLocation || undefined);
      const first = result.items[0];

      if (first) {
        const resolvedSchedule = {
          ...nextSchedule,
          latitude: Number(first.lat),
          longitude: Number(first.lng),
          address: first.roadAddress || first.address,
          placeName: first.name
        };

        setNextSchedule(resolvedSchedule);
        return resolvedSchedule;
      }
    } finally {
      setSearchingSchedule(false);
    }

    return nextSchedule;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const nextErrors = validate(currentLocation, nextSchedule);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !currentLocation) return;

    const resolvedSchedule = await searchNextSchedule();
    updateTripStore({
      currentLocation,
      nextSchedule: resolvedSchedule,
      partySize,
      transportMode
    });
    resetRecommendation();
    navigate('/preferences');
  };

  return (
    <form className="screen" onSubmit={handleSubmit}>
      <div className="screen-header">
        <span className="brand">자투립</span>
        <h1>다음 일정 전, 어디까지 다녀올까요?</h1>
      </div>

      <div className="form-stack">
        <section className="input-card">
          <LocationPicker
            value={currentLocation}
            onChange={(location) => {
              setCurrentLocation(location);
              setErrors((current) => ({ ...current, currentLocation: undefined }));
            }}
          />
          {errors.currentLocation ? <p className="field-error">{errors.currentLocation}</p> : null}
        </section>

        <section className="input-card">
          <label htmlFor="nextScheduleName">다음 일정</label>
          <input
            id="nextScheduleName"
            className="text-input"
            value={nextSchedule.name}
            onChange={(event) => setNextSchedule((current) => ({ ...current, name: event.target.value }))}
            onBlur={searchNextSchedule}
            placeholder="DCC 대전컨벤션센터"
          />
          {nextSchedule.latitude && nextSchedule.longitude ? (
            <p>{nextSchedule.placeName || nextSchedule.address}</p>
          ) : null}
          {errors.nextScheduleName ? <p className="field-error">{errors.nextScheduleName}</p> : null}
        </section>

        <section className="input-card">
          <label htmlFor="nextScheduleTime">일정 시간</label>
          <input
            id="nextScheduleTime"
            className="time-input"
            type="time"
            value={nextSchedule.time}
            onChange={(event) => setNextSchedule((current) => ({ ...current, time: event.target.value }))}
          />
          {errors.nextScheduleTime ? <p className="field-error">{errors.nextScheduleTime}</p> : null}
        </section>

        <section className="input-card counter">
          <span className="field-label">인원</span>
          <div className="counter-control">
            <button type="button" onClick={() => setPartySize((value) => Math.max(1, value - 1))}>
              -
            </button>
            <strong>{partySize}명</strong>
            <button type="button" onClick={() => setPartySize((value) => value + 1)}>
              +
            </button>
          </div>
        </section>

        <section className="input-card segmented">
          <span className="field-label">이동수단</span>
          <div className="transport-grid">
            {[
              { label: '도보', value: 'walk' as const },
              { label: '차량', value: 'car' as const }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`choice-button ${transportMode === option.value ? 'is-selected' : ''}`}
                onClick={() => setTransportMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="bottom-cta">
        <button type="submit" className="primary-button" disabled={searchingSchedule}>
          {searchingSchedule ? '장소 확인 중...' : '다음'}
        </button>
      </div>
    </form>
  );
};

export default HomePage;
