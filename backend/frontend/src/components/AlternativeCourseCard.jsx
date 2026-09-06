import React from 'react';
import { formatMinutes } from '../utils/time.js';

export default function AlternativeCourseCard({ course, selected, onSelect }) {
  const placeNames = course.points.filter((point) => point.type === 'place').map((point) => point.name);

  return (
    <article className={`alternative-card ${selected ? 'is-selected' : ''}`}>
      <div>
        <span>{course.title}</span>
        <h3>{placeNames.join(' → ')}</h3>
        <p>
          {formatMinutes(course.totalCourseMinutes)} · 여유 {formatMinutes(course.slackMinutes)}
        </p>
      </div>
      <button type="button" onClick={onSelect}>
        이 코스 보기
      </button>
    </article>
  );
}
