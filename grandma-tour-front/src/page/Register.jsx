import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [isCodeSent, setIsCodeSent] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const passwordsMatch =
    passwordConfirmation.length > 0 && password === passwordConfirmation

  const sendVerificationCode = async () => {
    setError('')
    setMessage('')

    if (!email) {
      setError('이메일을 입력해 주세요.')
      return
    }

    try {
      const response = await fetch('/api/auth/email-verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)

      setIsCodeSent(true)
      setIsVerified(false)
      setMessage(data.message)
    } catch (requestError) {
      setError(requestError.message || '인증번호 전송에 실패했습니다.')
    }
  }

  const verifyCode = async () => {
    try {
      const response = await fetch('/api/auth/email-verifications/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message)

      setError('')
      setIsVerified(true)
      setMessage(data.message)
    } catch (requestError) {
      setError(requestError.message || '이메일 인증에 실패했습니다.')
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    if (!isVerified) {
      setError('이메일 인증을 완료해 주세요.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 입력해 주세요.')
      return
    }
    if (password !== passwordConfirmation) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    setMessage('회원가입이 완료되었습니다. 로그인해 주세요.')
    window.setTimeout(() => navigate('/login'), 800)
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="register-title">
        <h1 id="register-title">회원가입</h1>

        <form onSubmit={handleSubmit}>
          <label htmlFor="register-email">이메일</label>
          <div className="input-action-row">
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              disabled={isVerified}
            />
            <button type="button" onClick={sendVerificationCode} disabled={isVerified}>
              인증 요청
            </button>
          </div>

          {isCodeSent && (
            <>
              <label htmlFor="verification-code">이메일 인증번호</label>
              <div className="input-action-row">
                <input
                  id="verification-code"
                  inputMode="numeric"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  placeholder="인증번호 6자리"
                  disabled={isVerified}
                />
                <button type="button" onClick={verifyCode} disabled={isVerified}>
                  {isVerified ? '인증 완료' : '확인'}
                </button>
              </div>
            </>
          )}

          <label htmlFor="register-password">비밀번호</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상 입력해 주세요"
            minLength="8"
            autoComplete="new-password"
          />

          <label htmlFor="password-confirmation">비밀번호 확인</label>
          <input
            id="password-confirmation"
            type="password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            placeholder="비밀번호를 한 번 더 입력해 주세요"
            minLength="8"
            autoComplete="new-password"
          />
          {passwordConfirmation && (
            <p className={passwordsMatch ? 'password-match' : 'password-mismatch'}>
              {passwordsMatch ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.'}
            </p>
          )}

          {error && <p className="login-error">{error}</p>}
          {message && <p className="register-message">{message}</p>}
          <button type="submit">회원가입</button>
        </form>

        <p className="login-signup">
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </section>
    </main>
  )
}
