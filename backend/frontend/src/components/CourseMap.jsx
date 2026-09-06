import React from 'react';

export default function CourseMap({ course }) {
  const points = course?.points || [];

  return (
    <section className="map-panel" aria-label="코스 지도">
      <div className="map-path">
        {points.map((point, index) => (
          <div key={`${point.name}-${index}`} className={`map-marker ${point.type}`}>
            <span>{index + 1}</span>
            <strong>{point.name}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
