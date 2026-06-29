import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

function isExternalMessengerTimeout(value = {}) {
  const message = String(value.message || value.reason?.message || value.reason || value.error?.message || '');
  const source = String(value.filename || value.source || '');
  const stack = String(value.error?.stack || value.reason?.stack || '');
  const isMessengerTimeout = message.includes('Window Messenger Timeout') && message.includes('urlChanged');
  const isExtensionSource = source.startsWith('chrome-extension://') || stack.includes('chrome-extension://');
  return isMessengerTimeout && isExtensionSource;
}

function installExternalErrorFilter() {
  window.addEventListener('error', (event) => {
    if (!isExternalMessengerTimeout(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    if (!isExternalMessengerTimeout(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}

installExternalErrorFilter();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

function clearLocalServiceWorkerState() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  }
  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

// Register service worker for PWA in production only. In local dev, unregister it so
// stale cache-first bundles/chunks cannot make the app appear blank after code changes.
if (process.env.NODE_ENV === 'development') {
  clearLocalServiceWorkerState();
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const publicUrl = process.env.PUBLIC_URL || '';
    navigator.serviceWorker.register(`${publicUrl}/sw.js`).catch(() => {});
  });
}
