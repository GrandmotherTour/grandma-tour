import { Navigate, Route, Routes } from 'react-router-dom'
import RegionListPage from './pages/RegionListPage.jsx'
import RegionDetailPage from './pages/RegionDetailPage.jsx'
import './App.css'
import PointDetailPage from './pages/PointDetailPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/regions" replace />} />
      <Route path="/regions" element={<RegionListPage />} />
      <Route path="/regions/:id" element={<RegionDetailPage />} />
      <Route path="/regions/:id/points/:pointId" element={<PointDetailPage />} />
    </Routes>
  )
}

export default App