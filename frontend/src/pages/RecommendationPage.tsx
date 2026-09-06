import { useNavigate } from 'react-router-dom';
import { tripStore } from '../store/tripStore';
import type { RecommendedCourse } from '../types/recommendation';

const getSlackText = (minutes: number) => {
  if (minutes <= 0) return '여유 없음';
  return `${minutes}분 여유`;
};

const CourseTimeline = ({ course }: { course: RecommendedCourse }) => {
  const destination = course.route.nextSchedule;

  return (
    <section className="route-card">
      <h2>코스 타임라인</h2>
      <ul className="timeline">
        <li className="timeline-item">
          <span className="timeline-dot">현</span>
          <div className="timeline-card">
            <strong>{course.route.currentLocation.placeName}</strong>
            <small>{course.route.currentLocation.address}</small>
          </div>
        </li>
        {course.stops.map((stop) => (
          <li className="timeline-item" key={stop.placeId}>
            <div className="timeline-line">↓ {stop.travelMinutesFromPrevious}분 이동</div>
            <span className="timeline-dot">{stop.order}</span>
            <div className="timeline-card">
              <strong>{stop.name}</strong>
              <small>도착 {stop.arrivalTimeLabel} · 체류 {stop.stayMinutes}분</small>
              {stop.address ? <small>{stop.address}</small> : null}
            </div>
          </li>
        ))}
        <li className="timeline-item">
          <div className="timeline-line">↓ {course.route.finalTravelMinutes}분 이동</div>
          <span className="timeline-dot">일</span>
          <div className="timeline-card">
            <strong>{destination.placeName || destination.name}</strong>
            <small>
              예상 도착 {course.route.estimatedArrivalAtNextScheduleLabel} · 다음 일정 {course.route.nextScheduleTimeLabel}
            </small>
            <small>{getSlackText(course.route.slackMinutes)}</small>
          </div>
        </li>
      </ul>
    </section>
  );
};

const RecommendationPage = () => {
  const navigate = useNavigate();
  const response = tripStore.recommendation;
  const course = response?.data.mainCourse;

  if (!response || response.status === 'invalid_request') {
    return (
      <section className="screen">
        <div className="empty-card">
          <h1>추천 조건이 없습니다.</h1>
          <p>필수 정보를 입력하고 다시 추천을 받아주세요.</p>
          <button type="button" className="primary-button" onClick={() => navigate('/')}>
            조건 입력
          </button>
        </div>
      </section>
    );
  }

  if (!course) {
    return (
      <section className="screen">
        <div className="empty-card">
          <h1>안전하게 들를 수 있는 장소가 없어요.</h1>
          <p>{response.message}</p>
          <button type="button" className="primary-button" onClick={() => navigate('/')}>
            조건 수정
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="screen">
      <div className="screen-header">
        <span className="brand">추천 결과</span>
        <h1>{course.title}</h1>
        <p>{course.summary}</p>
      </div>

      <div className="card-stack">
        <section className="route-card metric-grid">
          <div>
            <span>총 이동시간</span>
            <strong>{course.route.totalTravelMinutes}분</strong>
          </div>
          <div>
            <span>총 체류시간</span>
            <strong>{course.route.totalStayMinutes}분</strong>
          </div>
          <div>
            <span>예상 도착</span>
            <strong>{course.route.estimatedArrivalAtNextScheduleLabel}</strong>
          </div>
          <div>
            <span>다음 일정</span>
            <strong>{course.route.nextScheduleTimeLabel}</strong>
          </div>
        </section>

        <CourseTimeline course={course} />

        <section className="route-card">
          <h2>추천 이유</h2>
          {course.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </section>
      </div>

      <div className="bottom-cta">
        <button type="button" className="primary-button" onClick={() => navigate('/detail')}>
          최종 경로 보기
        </button>
        <button type="button" className="secondary-button" onClick={() => navigate('/preferences')}>
          취향 다시 선택
        </button>
      </div>
    </section>
  );
};

export default RecommendationPage;
