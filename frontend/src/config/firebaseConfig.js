const env = process.env || {};

function envOrDefault(names, fallback) {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    const value = env[key];
    if (value && value !== 'undefined' && value !== 'null') return value;
  }
  return fallback;
}

export const firebaseConfig = {
  apiKey: envOrDefault(['VITE_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_API_KEY'], "AIzaSyCO2SRwIwvqXJwqQNi3NfpDRFoE8DUyXj0"),
  authDomain: envOrDefault(['VITE_FIREBASE_AUTH_DOMAIN', 'REACT_APP_FIREBASE_AUTH_DOMAIN'], "pdrdata-bcdc9.firebaseapp.com"),
  databaseURL: envOrDefault(['VITE_FIREBASE_DATABASE_URL', 'REACT_APP_FIREBASE_DATABASE_URL'], "https://pdrdata-bcdc9-default-rtdb.firebaseio.com"),
  projectId: envOrDefault(['VITE_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_PROJECT_ID'], "pdrdata-bcdc9"),
  storageBucket: envOrDefault(['VITE_FIREBASE_STORAGE_BUCKET', 'REACT_APP_FIREBASE_STORAGE_BUCKET'], "pdrdata-bcdc9.firebasestorage.app"),
  messagingSenderId: envOrDefault(['VITE_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID'], "95091760805"),
  appId: envOrDefault(['VITE_FIREBASE_APP_ID', 'REACT_APP_FIREBASE_APP_ID'], "1:95091760805:web:d9232ada50b52e1903374c")
};

export const PATHS = {
  teams: 'koc_s3/teams',         // KOC3 teams
  matches: 'koc_s3/matches',     // KOC3 match results
  playerRatings: 'koc_s3/playerRatings', // UTR lookup table used by PTL
  admin: 'koc_s3/admin',         // { password }
  schedule: 'koc_s3/schedule',   // KOC3 fixtures
  season2: 'koc_s2/matches',     // Season 2 archive (read-only)
  koc2db: 'KOC2DB',              // Legacy KOC2 database for PTL rating history
  season1: 'KOC2DBPONEW'         // Older legacy archive fallback (read-only)
};
