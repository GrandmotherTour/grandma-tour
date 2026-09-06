import React from 'react';
import { formatMinutes } from '../utils/time.js';

function travelLabel(mode) {
  return mode === 'car' ? '차량' : '도보';
}

export default function CourseTimeline({ course }) {
  if (!course) return null;

  return (
    <section className="timeline-panel">
      <h2>Course Timeline</h2>
      <ol className="timeline">
        {course.points.map((point, index) => (
          <li key={`${point.name}-${index}`} className={`timeline-item ${point.type}`}>
            {point.travelFromPreviousMinutes ? (
              <div className="travel-line">
                {travelLabel(course.transportMode)} {formatMinutes(point.travelFromPreviousMinutes)}
              </div>
            ) : null}
            <div className="timeline-dot" />
            <div className="timeline-card">
              <span className="timeline-type">{point.type === 'start' ? '출발' : point.type === 'end' ? '도착' : point.tag}</span>
              <h3>{point.name}</h3>
              {point.type === 'start' ? <p>{point.time}</p> : null}
              {point.type === 'place' ? (
                <p>
                  {point.arrivalTime} ~ {point.leaveTime} · 체류 {formatMinutes(point.stayMinutes)}
                </p>
              ) : null}
              {point.type === 'end' ? (
                <p>
                  {point.arrivalTime} 도착 · 다음 일정 {point.nextScheduleTime} · 여유 {formatMinutes(point.slackMinutes)}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
