import React from 'react';
import { formatMinutes } from '../utils/time.js';

const tagLabels = {
  cafe: '카페',
  food: '맛집',
  nature: '산책',
  culture: '문화',
  history: '역사',
  activity: '체험',
};

export default function CourseSummary({ course }) {
  if (!course) return null;

  return (
    <section className="summary-panel">
      <div className="summary-grid">
        <div>
          <span>총 소요시간</span>
          <strong>{formatMinutes(course.totalCourseMinutes)}</strong>
        </div>
        <div>
          <span>이동시간</span>
          <strong>{formatMinutes(course.totalTravelMinutes)}</strong>
        </div>
        <div>
          <span>체류시간</span>
          <strong>{formatMinutes(course.totalStayMinutes)}</strong>
        </div>
        <div>
          <span>남은 여유</span>
          <strong>{formatMinutes(course.slackMinutes)}</strong>
        </div>
      </div>
      <div className="reason-box">
        <h2>추천 이유</h2>
        <p>{course.reason}</p>
        <div className="tag-row">
          {course.preferenceTags.map((tag) => (
            <span key={tag}>{tagLabels[tag] || tag}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
