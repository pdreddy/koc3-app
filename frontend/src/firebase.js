import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

function envOrDefault(name, fallback) {
  const value = process.env[name];
  if (!value || value === 'undefined' || value === 'null') return fallback;
  return value;
}

const firebaseConfig = {
  apiKey: envOrDefault('REACT_APP_FIREBASE_API_KEY', "AIzaSyDbO0eP52i4t3V94bEiDcl7WoKbSrrM9VA"),
  authDomain: envOrDefault('REACT_APP_FIREBASE_AUTH_DOMAIN', "koc2-20fb8.firebaseapp.com"),
  databaseURL: envOrDefault('REACT_APP_FIREBASE_DATABASE_URL', "https://koc2-20fb8-default-rtdb.firebaseio.com"),
  projectId: envOrDefault('REACT_APP_FIREBASE_PROJECT_ID', "koc2-20fb8"),
  storageBucket: envOrDefault('REACT_APP_FIREBASE_STORAGE_BUCKET', "koc2-20fb8.firebasestorage.app"),
  messagingSenderId: envOrDefault('REACT_APP_FIREBASE_MESSAGING_SENDER_ID', "317734341461"),
  appId: envOrDefault('REACT_APP_FIREBASE_APP_ID', "1:317734341461:web:1bcad5a1792fac0e46bddc")
};

if (!firebaseConfig.projectId || !firebaseConfig.databaseURL) {
  throw new Error('Firebase configuration is missing projectId or databaseURL. Check REACT_APP_FIREBASE_PROJECT_ID and REACT_APP_FIREBASE_DATABASE_URL.');
}

const parsedDatabaseUrl = new URL(firebaseConfig.databaseURL);
const databaseURL = parsedDatabaseUrl.toString();
const appName = 'koc3-app';

export const app = getApps().find(existingApp => existingApp.name === appName) || initializeApp(firebaseConfig, appName);
export const auth = getAuth(app);
export const db = getDatabase(app, databaseURL);

// DB access uses anonymous auth. Player accounts are lightweight profiles stored
// in the database (see services/playerAccount.js), not Firebase Auth identities.
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
  adminUsers: 'koc_s3/adminUsers', // RBAC admin user records
  schedule: 'koc_s3/schedule',   // KOC3 fixtures
  settings: 'koc_s3/settings',
  config: 'koc_s3/config',               // Config-driven season definition
  seasonTemplates: 'koc_s3/seasonTemplates', // Reusable "clone last season" templates
  players: 'koc_s3/players',             // Persistent player profiles (self-registration)
  joinRequests: 'koc_s3/joinRequests',   // Player requests to join a team (admin approves)
  standings: 'koc_s3/standings',
  pprcRatings: 'koc_s3/pprcRatings',
  playerHistory: 'koc_s3/playerHistory',
  teamHistory: 'koc_s3/teamHistory',
  playerMatchups: 'koc_s3/playerMatchups',
  teamMatchups: 'koc_s3/teamMatchups',
  playerEligibility: 'koc_s3/playerEligibility',
  cachedSummaries: 'koc_s3/cachedSummaries',
  auditLogs: 'koc_s3/auditLogs',
  koc2db: 'KOC2DB',              // Legacy KOC2 database for PTL rating history
  season1: 'KOC2DBPONEW'         // Older legacy archive fallback (read-only)
};
