import { useNavigate } from 'react-router-dom'
import './PaymentCompletePage.css'

function PaymentCompletePage() {
  const navigate = useNavigate()

  return (
    <main className="complete-page">
      <section className="complete-container">
        <div className="complete-content">
          <div className="complete-icon">
            ✓
          </div>

          <h1>예약이 완료되었어요!</h1>

          <p>
            할매투어와 함께하는
            <br />
            특별한 여행을 기대해주세요.
          </p>

          <div className="complete-card">
            <span>예약 코스</span>
            <strong>코스 1. 힐링 코스</strong>

            <div className="complete-divider" />

            <div>
              <span>여행 날짜</span>
              <strong>2026. 08. 30</strong>
            </div>

            <div>
              <span>결제 금액</span>
              <strong>45,000원</strong>
            </div>
          </div>
        </div>

        <button
          className="home-button"
          onClick={() => navigate('/home')}
        >
          홈으로 돌아가기
        </button>
      </section>
    </main>
  )
}

export default PaymentCompletePage