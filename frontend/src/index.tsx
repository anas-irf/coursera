import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './app/App';

// public/index.html always has the #root element; createRoot says so if it ever does not
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
