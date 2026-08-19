import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './PaymentPage.css'

function PaymentPage() {
  const navigate = useNavigate()
  const [paymentMethod, setPaymentMethod] = useState('card')

  return (
    <main className="payment-page">
      <section className="payment-container">
        <header className="payment-header">
          <button
            className="payment-back-button"
            onClick={() => navigate('/courses/1')}
          >
            ←
          </button>

          <h1>결제 및 예약</h1>
        </header>

        <section className="payment-section">
          <h2>선택한 코스</h2>

          <div className="selected-course">
            <div className="course-image-placeholder">
              코스 1
            </div>

            <div>
              <strong>코스 1. 힐링 코스</strong>
              <p>자연 속에서 쉬어가는 힐링 여행</p>
              <span>약 6시간</span>
            </div>
          </div>
        </section>

        <section className="payment-section">
          <h2>예약 정보</h2>

          <div className="reservation-row">
            <span>여행 날짜</span>
            <strong>2026. 08. 30</strong>
          </div>

          <div className="reservation-row">
            <span>인원</span>
            <strong>2명</strong>
          </div>
        </section>

        <section className="payment-section">
          <h2>결제 수단</h2>

          <button
            className={`payment-method ${
              paymentMethod === 'card' ? 'selected' : ''
            }`}
            onClick={() => setPaymentMethod('card')}
          >
            <span>신용 / 체크카드</span>
            <span className="radio">
              {paymentMethod === 'card' ? '●' : '○'}
            </span>
          </button>

          <button
            className={`payment-method ${
              paymentMethod === 'easy' ? 'selected' : ''
            }`}
            onClick={() => setPaymentMethod('easy')}
          >
            <span>간편결제</span>
            <span className="radio">
              {paymentMethod === 'easy' ? '●' : '○'}
            </span>
          </button>
        </section>

        <section className="price-section">
          <div>
            <span>코스 금액</span>
            <strong>45,000원</strong>
          </div>

          <div>
            <span>예약 수수료</span>
            <strong>0원</strong>
          </div>

          <div className="total-price">
            <span>총 결제 금액</span>
            <strong>45,000원</strong>
          </div>
        </section>

        <button
          className="payment-button"
          onClick={() => navigate('/payment/complete')}
        >
          45,000원 결제하기
        </button>
      </section>
    </main>
  )
}

export default PaymentPage