import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom'

import SplashPage from './pages/user/SplashPage'
import AuthPage from './pages/user/AuthPage'
import TravelPromptPage from './pages/user/TravelPromptPage'
import RegionPage from './pages/user/RegionPage'
import CoursePage from './pages/user/CoursePage'
import CourseDetailPage from './pages/user/CourseDetailPage'
import PaymentPage from './pages/user/PaymentPage'
import PaymentCompletePage from './pages/user/PaymentCompletePage'
import HomePage from './pages/user/HomePage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<SplashPage />}
        />

        <Route
          path="/auth"
          element={<AuthPage />}
        />

        <Route
          path="/travel"
          element={<TravelPromptPage />}
        />

        <Route
          path="/regions"
          element={<RegionPage />}
        />

        <Route
          path="/courses"
          element={<CoursePage />}
        />

        <Route
          path="/courses/1"
          element={<CourseDetailPage />}
        />

        <Route
          path="/payment"
          element={<PaymentPage />}
        />

        <Route
          path="/payment/complete"
          element={<PaymentCompletePage />}
        />

        <Route
          path="/home"
          element={<HomePage />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App