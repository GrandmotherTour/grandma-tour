import { useNavigate } from 'react-router-dom'
import './AuthPage.css'

function AuthPage() {
  const navigate = useNavigate()

  return (
    <main className="auth-page">
      <section className="auth-container">

        <div className="auth-content">
          <h1>환영합니다!</h1>

          <p className="auth-description">
            할매투어와 함께
            <br />
            특별한 여행을 떠나볼까요?
          </p>

          <div className="auth-buttons">
            <button
              className="auth-button primary"
              onClick={() => navigate('/travel')}
            >
              <span>이미 계정이 있으신가요?</span>
              <strong>로그인</strong>
            </button>

            <button
              className="auth-button secondary"
              onClick={() => navigate('/travel')}
            >
              <span>할매투어가 처음이신가요?</span>
              <strong>회원가입</strong>
            </button>
          </div>
        </div>

        <div className="auth-landscape">
          <div className="auth-cloud cloud-a" />
          <div className="auth-cloud cloud-b" />

          <div className="auth-ground" />

          <div className="auth-tree tree-a" />
          <div className="auth-tree tree-b" />
          <div className="auth-tree tree-c" />

          <div className="auth-house">
            <div className="auth-roof" />
            <div className="auth-house-body">
              <div className="auth-window" />
              <div className="auth-door" />
            </div>
          </div>
        </div>

      </section>
    </main>
  )
}

export default AuthPage