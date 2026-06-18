import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDbO0eP52i4t3V94bEiDcl7WoKbSrrM9VA",
  authDomain: "koc2-20fb8.firebaseapp.com",
  databaseURL: "https://koc2-20fb8-default-rtdb.firebaseio.com",
  projectId: "koc2-20fb8",
  storageBucket: "koc2-20fb8.firebasestorage.app",
  messagingSenderId: "317734341461",
  appId: "1:317734341461:web:1bcad5a1792fac0e46bddc"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

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
  season1: 'KOC2DBPONEW'         // Legacy Season 1 archive (read-only)
};
