import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRegionById, getRegionPoints } from '../api/regionApi.js'

function RegionDetailPage() {
  const { id } = useParams()

  const [region, setRegion] = useState(null)
  const [points, setPoints] = useState([])
  const [status, setStatus] = useState('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function loadRegion() {
      try {
        setStatus('loading')

        const [regionData, pointsData] = await Promise.all([
          getRegionById(id),
          getRegionPoints(id),
        ])

        setRegion(regionData)
        setPoints(pointsData)
        setStatus('success')
      } catch (error) {
        setErrorMessage(error.message)
        setStatus('error')
      }
    }

    loadRegion()
  }, [id])

  if (status === 'loading') {
    return (
      <main className="mobile-shell">
        <p>지역 정보를 불러오는 중입니다.</p>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="mobile-shell">
        <p>{errorMessage}</p>
      </main>
    )
  }

  return (
    <main className="mobile-shell">
      <h1>{region?.name}</h1>
      <p>{region?.description}</p>

      <section>
        <h2>관광 포인트</h2>

        {points.map((point) => (
          <Link
            key={point.id}
            to={`/regions/${id}/points/${point.id}`}
          >
            <article>
              <h3>{point.name}</h3>
              <p>{point.description}</p>
            </article>
          </Link>
        ))}
      </section>
    </main>
  )
}

export default RegionDetailPage