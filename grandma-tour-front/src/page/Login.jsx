import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    if (!email || !password) {
      setError('이메일과 비밀번호를 모두 입력해 주세요.')
      return
    }

    login({ name: '민서', email })
    navigate('/main', { replace: true })
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-logo" aria-hidden="true">👵</div>
        <h1 id="login-title">할매투어</h1>

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
          />

          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호를 입력해 주세요"
            autoComplete="current-password"
          />

          {error && <p className="login-error">{error}</p>}
          <button type="submit">로그인</button>
        </form>

        <div className="login-divider">또는</div>
        <button type="button" className="google-login" onClick={() => alert('구글 로그인 연동 기능 준비 중입니다.')}>
          🔎 구글로 계속하기
        </button>
      </section>
    </main>
  )
}
