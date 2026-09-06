import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingOverlay from '../components/LoadingOverlay.jsx';
import SwipeActions from '../components/SwipeActions.jsx';
import SwipeCard from '../components/SwipeCard.jsx';
import { requestRecommendation } from '../api/recommendationApi.js';
import { useJaturip } from '../context/JaturipContext.jsx';
import { calculatePreferenceWeights, preferenceTags } from '../utils/preferences.js';

function getNextSwipeResults(swipeResults, tag, action) {
  const existing = swipeResults[tag];
  const next = {
    ...existing,
    exposureCount: existing.exposureCount + 1,
  };

  if (action === 'like') next.likeCount += 1;
  if (action === 'dislike') next.dislikeCount += 1;
  if (action === 'skip') next.skipCount += 1;

  return {
    ...swipeResults,
    [tag]: next,
  };
}

export default function PreferencePage() {
  const navigate = useNavigate();
  const {
    userInput,
    swipeResults,
    recordSwipe,
    preferenceWeights,
    setRecommendationResult,
    setSelectedCourseIndex,
  } = useJaturip();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submitRecommendation = async (swipeSnapshot = swipeResults) => {
    setLoading(true);
    setError('');
    try {
      const result = await requestRecommendation({
        userInput,
        preferenceWeights: calculatePreferenceWeights(swipeSnapshot),
        swipeResults: swipeSnapshot,
      });
      setRecommendationResult(result);
      setSelectedCourseIndex(0);
      navigate('/result');
    } catch (_error) {
      setError('추천 코스를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    const currentTag = preferenceTags[currentIndex];
    const nextSwipeResults = getNextSwipeResults(swipeResults, currentTag.key, action);
    recordSwipe(currentTag.key, action);

    if (currentIndex >= preferenceTags.length - 1) {
      await submitRecommendation(nextSwipeResults);
      return;
    }

    setCurrentIndex((index) => index + 1);
  };

  const progress = ((currentIndex + 1) / preferenceTags.length) * 100;
  const currentTag = preferenceTags[currentIndex];

  return (
    <section className="page-card preference-page">
      {loading ? <LoadingOverlay /> : null}
      <div className="page-title center">
        <span>Preference</span>
        <h1>취향을 알려주세요</h1>
        <p>{currentIndex + 1} / {preferenceTags.length}</p>
      </div>
      <div className="progress-track">
        <div style={{ width: `${progress}%` }} />
      </div>
      {error ? (
        <div className="error-state">
          <h2>추천 코스를 불러오지 못했어요.</h2>
          <p>잠시 후 다시 시도해주세요.</p>
          <button type="button" onClick={submitRecommendation}>다시 시도</button>
        </div>
      ) : (
        <>
          <SwipeCard tag={currentTag} onAction={handleAction} />
          <SwipeActions onAction={handleAction} />
        </>
      )}
    </section>
  );
}
