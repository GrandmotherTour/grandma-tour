import { useNavigate } from 'react-router-dom';
import { tripStore } from '../store/tripStore';

const DetailPage = () => {
  const navigate = useNavigate();
  const course = tripStore.recommendation?.data.mainCourse;

  if (!course) {
    return (
      <section className="screen">
        <div className="empty-card">
          <h1>표시할 최종 경로가 없습니다.</h1>
          <button type="button" className="primary-button" onClick={() => navigate('/')}>
            처음으로
          </button>
        </div>
      </section>
    );
  }

  const markers = [
    {
      label: '현',
      name: course.route.currentLocation.placeName,
      address: course.route.currentLocation.address
    },
    ...course.stops.map((stop) => ({
      label: String(stop.order),
      name: stop.name,
      address: stop.address || `${stop.latitude}, ${stop.longitude}`
    })),
    {
      label: '일',
      name: course.route.nextSchedule.placeName || course.route.nextSchedule.name,
      address: course.route.nextSchedule.address || `${course.route.nextSchedule.latitude}, ${course.route.nextSchedule.longitude}`
    }
  ];

  return (
    <section className="screen">
      <div className="screen-header">
        <span className="brand">최종 경로</span>
        <h1>다음 일정까지 이 순서로 이동하세요</h1>
        <p>
          {course.route.estimatedArrivalAtNextScheduleLabel} 도착 예상 · {course.route.slackMinutes}분 여유
        </p>
      </div>

      <div className="card-stack">
        <section className="route-map">
          {markers.map((marker) => (
            <div className="map-marker" key={`${marker.label}-${marker.name}`}>
              <span>{marker.label}</span>
              <div>
                <strong>{marker.name}</strong>
                <small>{marker.address}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="route-card">
          <h2>시간 요약</h2>
          <div className="metric-grid">
            <div>
              <span>전체 코스</span>
              <strong>{course.route.totalCourseMinutes}분</strong>
            </div>
            <div>
              <span>안전 버퍼</span>
              <strong>{course.route.totalBufferMinutes}분</strong>
            </div>
            <div>
              <span>이동수단</span>
              <strong>{course.route.transportMode === 'walk' ? '도보' : '차량'}</strong>
            </div>
            <div>
              <span>인원</span>
              <strong>{course.route.partySize}명</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="bottom-cta">
        <button type="button" className="secondary-button" onClick={() => navigate(-1)}>
          이전
        </button>
      </div>
    </section>
  );
};

export default DetailPage;
