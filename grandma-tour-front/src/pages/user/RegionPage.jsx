import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import RegionMap from '../../components/map/RegionMap'

import './RegionPage.css'

function RegionPage() {
  const navigate = useNavigate()

  const [selectedRegion, setSelectedRegion] = useState(null)

  return (
    <main className="region-page">
      <section className="region-container">

        <header className="region-header">
          <button
            className="back-button"
            onClick={() => navigate('/travel')}
          >
            ←
          </button>

          <div>
            <h1>어디로 떠나볼까요?</h1>
            <p>지도에서 여행하고 싶은 지역을 선택해주세요.</p>
          </div>
        </header>


        <div className="map-area">
          <RegionMap onSelectRegion={setSelectedRegion} />
        </div>


        <section className="region-info">
          {selectedRegion ? (
            <>
              <span className="region-label">선택한 지역</span>

              <h2>{selectedRegion}</h2>

              <p>
                이곳에는 선택한 지역의 특징과
                여행 정보를 보여줄 예정입니다.
              </p>
            </>
          ) : (
            <>
              <h2>지역을 선택해주세요</h2>

              <p>
                지도 위의 포인트를 눌러
                지역 정보를 확인할 수 있습니다.
              </p>
            </>
          )}

          <button
            className="select-region-button"
            disabled={!selectedRegion}
            onClick={() => navigate('/courses')}
          >
            지역 선택하기
          </button>
        </section>

      </section>
    </main>
  )
}

export default RegionPage