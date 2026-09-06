import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tripStore, updateTripStore } from '../store/tripStore';
import type { PreferenceTag } from '../types/recommendation';

const preferenceCards: Array<{
  key: PreferenceTag;
  category: string;
  name: string;
  description: string;
}> = [
  { key: 'cafe', category: 'cafe', name: '카페', description: '잠깐 앉아 쉬기 좋은 공간' },
  { key: 'food', category: 'food', name: '맛집', description: '남는 시간에 즐기는 식사와 간식' },
  { key: 'nature', category: 'nature', name: '자연', description: '가볍게 걷고 환기하기 좋은 장소' },
  { key: 'culture', category: 'culture', name: '문화', description: '전시와 공연, 문화시설 중심 코스' },
  { key: 'history', category: 'history', name: '역사', description: '지역의 이야기와 건축을 만나는 장소' },
  { key: 'activity', category: 'activity', name: '체험', description: '짧게 즐길 수 있는 활동형 장소' }
];

const PreferencePage = () => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [preferences, setPreferences] = useState<PreferenceTag[]>(tripStore.preferences);
  const currentCard = preferenceCards[index];
  const progress = ((index + 1) / preferenceCards.length) * 100;

  const goNext = (nextPreferences: PreferenceTag[]) => {
    if (index >= preferenceCards.length - 1) {
      updateTripStore({ preferences: nextPreferences });
      navigate('/loading');
      return;
    }

    setIndex((current) => current + 1);
  };

  const handleLike = () => {
    const nextPreferences = preferences.includes(currentCard.key)
      ? preferences
      : [...preferences, currentCard.key];

    setPreferences(nextPreferences);
    goNext(nextPreferences);
  };

  const handleDislike = () => {
    goNext(preferences.filter((preference) => preference !== currentCard.key));
  };

  return (
    <section className="screen">
      <div className="screen-header">
        <span className="brand">취향 선택</span>
        <h1>어떤 장소가 끌리나요?</h1>
        <p>{index + 1} / {preferenceCards.length}</p>
      </div>

      <div className="card-stack">
        <div className="progress-track">
          <div style={{ width: `${progress}%` }} />
        </div>
        <article className="preference-card">
          <div className={`preference-image ${currentCard.key}`} />
          <div className="preference-content">
            <span className="preference-chip">{currentCard.category}</span>
            <h2>{currentCard.name}</h2>
            <p>{currentCard.description}</p>
          </div>
        </article>
      </div>

      <div className="bottom-cta action-grid">
        <button type="button" className="danger-button" onClick={handleDislike}>
          별로예요
        </button>
        <button type="button" className="primary-button" onClick={handleLike}>
          좋아요
        </button>
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
          이전
        </button>
      </div>
    </section>
  );
};

export default PreferencePage;
