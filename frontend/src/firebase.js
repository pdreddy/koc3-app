import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

import { firebaseAppName, firebaseConfig } from './firebaseConfig';
import { PATHS } from './firebasePaths';

if (!firebaseConfig.projectId || !firebaseConfig.databaseURL) {
  throw new Error('Firebase configuration is missing projectId or databaseURL. Check REACT_APP_FIREBASE_PROJECT_ID and REACT_APP_FIREBASE_DATABASE_URL.');
}

const parsedDatabaseUrl = new URL(firebaseConfig.databaseURL);
const databaseURL = parsedDatabaseUrl.toString();


export const app = getApps().find(existingApp => existingApp.name === firebaseAppName) || initializeApp(firebaseConfig, firebaseAppName);
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

export { PATHS };
