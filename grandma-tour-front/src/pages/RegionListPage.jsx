import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getRegions } from '../api/regionApi.js'

function RegionCard({ region }) {
  return (
    <Link
      to={`/regions/${region.id}`}
      className="region-card"
    >
      <div className="region-card__image">
        {region.image_url ? (
          <img src={region.image_url} alt="" />
        ) : (
          <span>{region.name?.slice(0, 1) || '지'}</span>
        )}
      </div>

      <div className="region-card__body">
        <p className="region-card__eyebrow">추천 여행 지역</p>
        <h2>{region.name}</h2>
        <p>{region.description || '이 지역의 여행 코스를 준비하고 있어요.'}</p>
      </div>
    </Link>
  )
}

function RegionListPage() {
  const [regions, setRegions] = useState([])
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadRegions() {
      try {
        setStatus('loading')
        const data = await getRegions()

        if (ignore) return

        setRegions(Array.isArray(data) ? data : [])
        setStatus(Array.isArray(data) && data.length > 0 ? 'success' : 'empty')
      } catch (error) {
        if (ignore) return

        setErrorMessage(error.message)
        setStatus('error')
      }
    }

    loadRegions()

    return () => {
      ignore = true
    }
  }, [])

  return (
    <main className="mobile-shell">
      <header className="page-header">
        <p>할매투어</p>
        <h1>어디로 떠나볼까요?</h1>
        <span>지역을 고르면 맞춤 여행 코스를 이어서 추천해드릴게요.</span>
      </header>

      {status === 'loading' && (
        <section className="state-card" aria-live="polite">
          <strong>지역을 불러오는 중입니다</strong>
          <p>잠시만 기다려 주세요.</p>
        </section>
      )}

      {status === 'error' && (
        <section className="state-card state-card--error" aria-live="assertive">
          <strong>지역을 불러오지 못했습니다</strong>
          <p>{errorMessage}</p>
        </section>
      )}

      {status === 'empty' && (
        <section className="state-card">
          <strong>아직 등록된 지역이 없습니다</strong>
          <p>백엔드의 지역 데이터가 준비되면 이곳에 표시됩니다.</p>
        </section>
      )}

      {status === 'success' && (
        <section className="region-list" aria-label="지역 목록">
          {regions.map((region) => (
            <RegionCard key={region.id} region={region} />
          ))}
        </section>
      )}
    </main>
  )
}

export default RegionListPage
