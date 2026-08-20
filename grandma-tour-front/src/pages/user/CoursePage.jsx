import { useNavigate } from 'react-router-dom'
import { mockCourses } from '../../data/mockCourses'
import './CoursePage.css'

function CoursePage() {
  const navigate = useNavigate()

  const handleCourseClick = (courseId) => {
    // 현재는 코스 1만 활성화
    if (courseId === 1) {
      navigate('/courses/1')
    }
  }

  return (
    <main className="course-page">
      <section className="course-container">

        <header className="course-header">
          <button
            className="course-back-button"
            onClick={() => navigate('/regions')}
          >
            ←
          </button>

          <div>
            <h1>코스를 선택해주세요</h1>
            <p>원하는 코스를 선택하고 특별한 여행을 떠나보세요.</p>
          </div>
        </header>

        <section className="course-list">
          {mockCourses.map((course) => (
            <button
              key={course.id}
              className={`course-card ${
                course.id !== 1 ? 'disabled' : ''
              }`}
              onClick={() => handleCourseClick(course.id)}
            >
              <div className="course-thumbnail">
                <span>{course.id}</span>
              </div>

              <div className="course-card-content">
                <div className="course-title-row">
                  <h2>{course.title}</h2>

                  <span className="course-tag">
                    {course.tag}
                  </span>
                </div>

                <p>{course.description}</p>

                <span className="course-sub-description">
                  {course.subDescription}
                </span>
              </div>
            </button>
          ))}
        </section>

        <button
          className="course-disabled-button"
          disabled
        >
          이전으로
        </button>

      </section>
    </main>
  )
}

export default CoursePage