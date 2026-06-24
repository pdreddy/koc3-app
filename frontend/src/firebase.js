import { getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { LEGACY_PATHS, PATHS as DEFAULT_TENANT_PATHS, buildTenantPaths } from './utils/tenantPaths';

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

let authPromise = null;
export function ensureAuth() {
  if (!authPromise) {
    authPromise = signInAnonymously(auth).catch(err => {
      console.error('Anonymous auth failed', err);
    });
  }
  return authPromise;
}

// Firebase RTDB paths. New writes default to tenant-scoped commercial paths.
// Legacy koc_s3 paths remain available through LEGACY_PATHS for migration/rollback.
export { LEGACY_PATHS, buildTenantPaths };
export const PATHS = DEFAULT_TENANT_PATHS;
