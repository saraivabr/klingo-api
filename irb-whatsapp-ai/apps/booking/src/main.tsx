import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// v3 - force rebuild

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
