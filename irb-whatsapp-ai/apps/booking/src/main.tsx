import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ExamUpload from './ExamUpload';
import './index.css';
// v3 - force rebuild

const path = window.location.pathname;
const Root = /\/enviar-pedido/.test(path) ? ExamUpload : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
