import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent noisy Vite / HMR sandbox websocket disconnected rejections from triggering global overlay errors
if (typeof window !== 'undefined') {
  const isWebsocketError = (message: string) => {
    return (
      message.includes('websocket') || 
      message.includes('WebSocket') || 
      message.includes('HMR') || 
      message.includes('vite')
    );
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || '');
    if (isWebsocketError(message)) {
      event.preventDefault();
      console.debug('Suppressed benign sandbox HMR rejection:', message);
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    if (isWebsocketError(message)) {
      event.preventDefault();
      console.debug('Suppressed benign sandbox error:', message);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
