// Player account service — wraps Firebase Authentication (email/password) for
// player self-registration, sign-in, password reset and sign-out. Sits behind a
// small service boundary so the auth provider can be swapped without touching
// the UI.
//
// NOTE: requires the Email/Password sign-in provider to be enabled in the
// Firebase console (Authentication → Sign-in method). The rest of the app keeps
// using anonymous auth for guest DB access; the firebase.js watcher restores
// anonymous access automatically when a player signs out.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword
} from 'firebase/auth';
import { auth } from '../firebase';

function friendlyError(err) {
  const code = err?.code || '';
  const map = {
    'auth/email-already-in-use': 'An account already exists for this email. Try signing in.',
    'auth/invalid-email': 'That email address is not valid.',
    'auth/weak-password': 'Password is too weak (use at least 6 characters).',
    'auth/user-not-found': 'No account found for that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled for this project yet.'
  };
  return new Error(map[code] || err?.message || 'Authentication failed.');
}

export async function registerPlayerAuth(email, password) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
    return cred.user.uid;
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function signInPlayerAuth(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, String(email).trim(), password);
    return cred.user;
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function signOutPlayerAuth() {
  // The firebase.js auth watcher signs back in anonymously after this.
  await signOut(auth);
}

export async function resetPlayerPassword(email) {
  try {
    await sendPasswordResetEmail(auth, String(email).trim());
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function changeCurrentPassword(newPassword) {
  if (!auth.currentUser) throw new Error('You must be signed in to change your password.');
  try {
    await updatePassword(auth.currentUser, newPassword);
  } catch (err) {
    throw friendlyError(err);
  }
}

export function currentAuthUser() {
  return auth.currentUser;
}
