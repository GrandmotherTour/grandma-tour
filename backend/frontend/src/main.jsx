import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { JaturipProvider } from './context/JaturipContext.jsx';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <JaturipProvider>
        <App />
      </JaturipProvider>
    </BrowserRouter>
  </React.StrictMode>
);
