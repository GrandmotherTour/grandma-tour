import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlternativeCourseCard from '../components/AlternativeCourseCard.jsx';
import CourseMap from '../components/CourseMap.jsx';
import CourseSummary from '../components/CourseSummary.jsx';
import CourseTimeline from '../components/CourseTimeline.jsx';
import LoadingOverlay from '../components/LoadingOverlay.jsx';
import { requestRecommendation } from '../api/recommendationApi.js';
import { useJaturip } from '../context/JaturipContext.jsx';

export default function ResultPage() {
  const navigate = useNavigate();
  const {
    userInput,
    swipeResults,
    preferenceWeights,
    recommendationResult,
    setRecommendationResult,
    selectedCourseIndex,
    setSelectedCourseIndex,
  } = useJaturip();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const courses = useMemo(() => {
    if (!recommendationResult) return [];
    return [recommendationResult.mainCourse, ...(recommendationResult.alternatives || [])].filter(Boolean);
  }, [recommendationResult]);

  const selectedCourse = courses[selectedCourseIndex] || courses[0];

  const retry = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await requestRecommendation({ userInput, preferenceWeights, swipeResults });
      setRecommendationResult(result);
      setSelectedCourseIndex(0);
    } catch (_error) {
      setError('추천 코스를 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  if (!recommendationResult) {
    return (
      <section className="page-card empty-state">
        <h1>현재 조건에서는 추천 코스를 찾지 못했어요.</h1>
        <p>조건을 입력하고 취향 선택을 완료하면 결과를 확인할 수 있습니다.</p>
        <button type="button" onClick={() => navigate('/')}>조건 수정</button>
      </section>
    );
  }

  if (courses.length === 0) {
    return (
      <section className="page-card empty-state">
        <h1>현재 조건에서는 안전하게 추천할 수 있는 코스를 찾지 못했어요.</h1>
        <p>할애 시간을 늘리거나 이동방법을 변경해보세요.</p>
        <button type="button" onClick={() => navigate('/')}>조건 수정</button>
      </section>
    );
  }

  return (
    <section className="result-page">
      {loading ? <LoadingOverlay message="다시 추천 코스를 찾고 있어요." /> : null}
      <div className="result-header">
        <div>
          <span>Result · {recommendationResult.source}</span>
          <h1>{selectedCourse.title}</h1>
          <p>예상 도착 {selectedCourse.expectedArrivalTime} · 다음 일정 {selectedCourse.nextScheduleTime}</p>
        </div>
        <div className="button-row compact">
          <button type="button" className="secondary-button" onClick={() => navigate('/')}>조건 수정하기</button>
          <button type="button" className="primary-button" onClick={retry}>다시 추천받기</button>
        </div>
      </div>

      {error ? (
        <div className="error-state">
          <h2>추천 코스를 불러오지 못했어요.</h2>
          <p>잠시 후 다시 시도해주세요.</p>
          <button type="button" onClick={retry}>다시 시도</button>
        </div>
      ) : null}

      <div className="result-grid">
        <CourseMap course={selectedCourse} />
        <CourseTimeline course={selectedCourse} />
      </div>
      <CourseSummary course={selectedCourse} />

      <section className="alternatives-section">
        <h2>대안 코스</h2>
        <div className="alternative-grid">
          {courses.slice(1).map((course, index) => (
            <AlternativeCourseCard
              key={course.id}
              course={course}
              selected={selectedCourseIndex === index + 1}
              onSelect={() => setSelectedCourseIndex(index + 1)}
            />
          ))}
        </div>
      </section>
    </section>
  );
}
