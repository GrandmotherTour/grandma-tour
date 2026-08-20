import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './TravelPromptPage.css'

function TravelPromptPage() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')

  const handleSubmit = () => {
    if (!prompt.trim()) return

    // 현재는 LLM API 연결 전이므로 다음 화면으로만 이동
    navigate('/regions')
  }

  return (
    <main className="travel-page">
      <section className="travel-container">
        <header className="travel-header">
          <button
            className="travel-back-button"
            onClick={() => navigate('/auth')}
          >
            ←
          </button>

          <div>
            <h1>어떤 여행을 원하시나요?</h1>
            <p>
              원하는 여행을 자유롭게 이야기해주세요.
            </p>
          </div>
        </header>

        <section className="prompt-section">
          <div className="prompt-title">
            <span>🌿</span>
            <h2>할매투어에게 알려주세요</h2>
          </div>

          <textarea
            className="travel-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              '예) 사람이 많지 않고 조용한 곳에서 쉬고 싶어요. 지역 음식도 먹어보고 자연 풍경도 보고 싶어요.'
            }
          />

          <p className="prompt-guide">
            입력한 내용을 바탕으로 여행 지역과 코스를 추천해드릴 예정입니다.
          </p>
        </section>

        <div className="travel-bottom">
          <button
            className="travel-next-button"
            disabled={!prompt.trim()}
            onClick={handleSubmit}
          >
            다음
          </button>

          <button
            className="travel-skip-button"
            onClick={() => navigate('/regions')}
          >
            건너뛰기
          </button>
        </div>
      </section>
    </main>
  )
}

export default TravelPromptPage