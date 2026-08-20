import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './SplashPage.css'

function SplashPage() {
  const navigate = useNavigate()
  
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/auth')
    }, 1800)  

    return () => clearTimeout(timer)
  }, [navigate])
  
  return (
    <main className="splash-page">
      <section className="splash-content">
        <div className="brand">
          <div className="leaf">⌁</div>

          <h1>할매투어</h1>

          <p>
            할매니와 함께하는
            <br />
            특별한 로컬 여행
          </p>
        </div>

        <div className="landscape">
          <div className="cloud cloud-left" />
          <div className="cloud cloud-right" />

          <div className="mountain mountain-back" />
          <div className="mountain mountain-front" />

          <div className="road" />

          <div className="tree tree-1" />
          <div className="tree tree-2" />
          <div className="tree tree-3" />

          <div className="house">
            <div className="roof" />
            <div className="house-body">
              <div className="window" />
              <div className="door" />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default SplashPage