import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// This project deliberately does NOT hardcode any fallback project credentials — unlike
// ../frontend, which is a single-tenant app tied to one known project. This platform is
// meant to run against whichever Firestore project each deployment configures, so a
// missing env var should fail loudly at startup rather than silently pointing at someone
// else's data.
function requiredEnv(key: string): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(
      `Missing required Firebase env var: ${key}. Copy .env.example to .env.local and fill in your Firestore project's config.`
    );
  }
  return value;
}

const firebaseConfig: FirebaseOptions = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
