import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppHeader from './components/AppHeader.jsx';
import InputPage from './pages/InputPage.jsx';
import PreferencePage from './pages/PreferencePage.jsx';
import ResultPage from './pages/ResultPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<InputPage />} />
          <Route path="/preference" element={<PreferencePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
