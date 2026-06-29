function envOrDefault(viteKey, reactKey, fallback) {
  // Vite: import.meta.env.VITE_*
  const viteVal = import.meta.env?.[viteKey];
  if (viteVal && viteVal !== 'undefined' && viteVal !== 'null') return viteVal;
  // CRA fallback (kept for backwards compat during transition)
  const reactVal = typeof process !== 'undefined' ? process.env?.[reactKey] : undefined;
  if (reactVal && reactVal !== 'undefined' && reactVal !== 'null') return reactVal;
  return fallback;
}

export const firebaseConfig = {
  apiKey:            envOrDefault('VITE_FIREBASE_API_KEY',              'REACT_APP_FIREBASE_API_KEY',              'AIzaSyDbO0eP52i4t3V94bEiDcl7WoKbSrrM9VA'),
  authDomain:        envOrDefault('VITE_FIREBASE_AUTH_DOMAIN',          'REACT_APP_FIREBASE_AUTH_DOMAIN',          'koc2-20fb8.firebaseapp.com'),
  databaseURL:       envOrDefault('VITE_FIREBASE_DATABASE_URL',         'REACT_APP_FIREBASE_DATABASE_URL',         'https://koc2-20fb8-default-rtdb.firebaseio.com'),
  projectId:         envOrDefault('VITE_FIREBASE_PROJECT_ID',           'REACT_APP_FIREBASE_PROJECT_ID',           'koc2-20fb8'),
  storageBucket:     envOrDefault('VITE_FIREBASE_STORAGE_BUCKET',       'REACT_APP_FIREBASE_STORAGE_BUCKET',       'koc2-20fb8.firebasestorage.app'),
  messagingSenderId: envOrDefault('VITE_FIREBASE_MESSAGING_SENDER_ID',  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',  '317734341461'),
  appId:             envOrDefault('VITE_FIREBASE_APP_ID',               'REACT_APP_FIREBASE_APP_ID',               '1:317734341461:web:1bcad5a1792fac0e46bddc'),
};

export const firebaseAppName = 'koc3-app';
