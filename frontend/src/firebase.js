import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { firebaseConfig, PATHS } from './config/firebaseConfig.js';

export { PATHS };

if (!firebaseConfig.projectId || !firebaseConfig.databaseURL) {
  throw new Error('Firebase configuration is missing projectId or databaseURL. Check VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_DATABASE_URL.');
}

const parsedDatabaseUrl = new URL(firebaseConfig.databaseURL);
const databaseURL = parsedDatabaseUrl.toString();
const firebaseGlobal = typeof window !== 'undefined' ? window : null;
if (firebaseGlobal) {
  const currentDefaults = firebaseGlobal.__FIREBASE_DEFAULTS__ || {};
  firebaseGlobal.__FIREBASE_DEFAULTS__ = {
    ...currentDefaults,
    config: {
      ...(currentDefaults.config || {}),
      ...firebaseConfig,
      databaseURL
    }
  };
}

export const app = getApps().find(existingApp => existingApp.name === '[DEFAULT]') || initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app, databaseURL);

let authPromise = null;
export function ensureAuth() {
  if (!authPromise) {
    authPromise = signInAnonymously(auth).catch(err => {
      console.error('Anonymous auth failed', err);
    });
  }
  return authPromise;
}
