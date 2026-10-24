import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

if (typeof document !== 'undefined') {
  document.title = 'ReCodeX – Write. Run. Optimize. Evolve.';
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
