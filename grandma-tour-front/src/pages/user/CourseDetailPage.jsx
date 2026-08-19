import { useNavigate } from 'react-router-dom'
import { mockCourses } from '../../data/mockCourses'
import './CourseDetailPage.css'

function CourseDetailPage() {
  const navigate = useNavigate()

  const course = mockCourses.find((course) => course.id === 1)

  return (
    <main className="course-detail-page">
      <section className="course-detail-container">

        <header className="course-detail-header">
          <button
            onClick={() => navigate('/courses')}
          >
            ←
          </button>

          <div>
            <span>추천 코스</span>
            <h1>{course.title}</h1>
          </div>
        </header>

        <section className="course-summary">
          <span className="detail-tag">
            {course.tag}
          </span>

          <p>{course.description}</p>

          <strong>{course.duration}</strong>
        </section>


        <section className="course-point-list">

          {course.points.map((point, index) => (
            <div
              className="course-point-wrapper"
              key={point.id}
            >

              <article className="course-point">
                <div className="point-number">
                  {index + 1}
                </div>

                <div className="point-content">
                  <span className="point-category">
                    {point.category}
                  </span>

                  <h2>{point.name}</h2>

                  <p>{point.description}</p>

                  <span className="stay-time">
                    체류시간 {point.stayTime}
                  </span>
                </div>
              </article>


              {point.travelTime && (
                <div className="travel-time">
                  <div className="travel-line" />

                  <span>
                    ↓ {point.travelTime}
                  </span>
                </div>
              )}

            </div>
          ))}

        </section>


        <section className="course-total">
          <span>총 예상 소요시간</span>
          <strong>{course.duration}</strong>
        </section>


        <button
          className="select-course-button"
          onClick={() => navigate('/payment')}
        >
          이 코스 선택하기
        </button>

      </section>
    </main>
  )
}

export default CourseDetailPage