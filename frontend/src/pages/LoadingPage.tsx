import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recommendationApi } from '../api/recommendationApi';
import { tripStore, updateTripStore } from '../store/tripStore';

const LoadingPage = () => {
  const navigate = useNavigate();
  const requestedRef = useRef(false);
  const [error, setError] = useState('');

  const requestRecommendation = async () => {
    if (!tripStore.currentLocation || !tripStore.nextSchedule.time || !tripStore.nextSchedule.name) {
      navigate('/', { replace: true });
      return;
    }

    setError('');

    try {
      const response = await recommendationApi.getRecommendation({
        currentLatitude: tripStore.currentLocation.latitude,
        currentLongitude: tripStore.currentLocation.longitude,
        nextScheduleTime: tripStore.nextSchedule.time,
        nextScheduleLatitude: tripStore.nextSchedule.latitude || tripStore.currentLocation.latitude,
        nextScheduleLongitude: tripStore.nextSchedule.longitude || tripStore.currentLocation.longitude,
        peopleCount: tripStore.partySize,
        transportMode: tripStore.transportMode,
        swipeFeedbacks: tripStore.preferences.map((tag, index) => ({
          cardId: `${tag}-${index}`,
          action: 'like',
          tags: [tag]
        })),
        nextSchedule: tripStore.nextSchedule
      });

      updateTripStore({ recommendation: response });
      navigate('/recommendation', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '추천 요청에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void requestRecommendation();
  }, []);

  if (error) {
    return (
      <section className="loading-screen">
        <div className="empty-card">
          <h1>추천 코스를 불러오지 못했어요.</h1>
          <p>{error}</p>
          <div className="form-stack">
            <button type="button" className="primary-button" onClick={requestRecommendation}>
              다시 시도
            </button>
            <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
              이전
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="loading-screen">
      <div>
        <div className="spinner" />
        <h1>다음 일정에 맞는 자투리 코스를 계산하고 있어요</h1>
        <p>이동시간과 체류시간을 함께 확인하는 중입니다.</p>
      </div>
    </section>
  );
};

export default LoadingPage;
