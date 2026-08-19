import { useNavigate } from 'react-router-dom'
import './HomePage.css'

function HomePage() {
  const navigate = useNavigate()

  return (
    <main className="home-page">
      <section className="home-container">

        <header className="home-header">
          <button className="menu-button">
            ☰
          </button>

          <button className="notification-button">
            ♢
          </button>
        </header>

        <section className="home-main">
          <div className="home-message-card">
            <p>
              오늘도 좋은 여행 되세요! 🌿
            </p>

            <h1>
              어디로 떠나볼까요?
            </h1>

            <button
              className="start-tour-button"
              onClick={() => navigate('/travel')}
            >
              투어 떠나기
            </button>
          </div>
        </section>

        <nav className="bottom-nav">
          <button className="nav-item active">
            <span className="nav-icon">⌂</span>
            <span>홈</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">▣</span>
            <span>예약 정보</span>
          </button>

          <button className="nav-item">
            <span className="nav-icon">♙</span>
            <span>내 정보</span>
          </button>
        </nav>

      </section>
    </main>
  )
}

export default HomePage