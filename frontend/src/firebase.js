import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDbO0eP52i4t3V94bEiDcl7WoKbSrrM9VA",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "koc2-20fb8.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://koc2-20fb8-default-rtdb.firebaseio.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "koc2-20fb8",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "koc2-20fb8.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "317734341461",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:317734341461:web:1bcad5a1792fac0e46bddc"
};

if (!firebaseConfig.projectId || !firebaseConfig.databaseURL) {
  throw new Error('Firebase configuration is missing projectId or databaseURL. Check REACT_APP_FIREBASE_PROJECT_ID and REACT_APP_FIREBASE_DATABASE_URL.');
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, firebaseConfig.databaseURL);

let authPromise = null;
export function ensureAuth() {
  if (!authPromise) {
    authPromise = signInAnonymously(auth).catch(err => {
      console.error('Anonymous auth failed', err);
    });
  }
  return authPromise;
}

// Firebase RTDB paths
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
