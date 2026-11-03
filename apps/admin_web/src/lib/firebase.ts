import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? 'demo',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'lux-dev.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'lux-dev',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'lux-dev.appspot.com',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '0',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? 'demo',
};

export function getFirebaseApp() {
  return getApps()[0] ?? initializeApp(config);
}

export function getDb() {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' &&
    !(globalThis as { __luxFsEmu?: boolean }).__luxFsEmu
  ) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    (globalThis as { __luxFsEmu?: boolean }).__luxFsEmu = true;
  }
  return db;
}

export function getFirebaseAuth() {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' &&
    !(globalThis as { __luxAuthEmu?: boolean }).__luxAuthEmu
  ) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    (globalThis as { __luxAuthEmu?: boolean }).__luxAuthEmu = true;
  }
  return auth;
}

export function getFirebaseFunctions() {
  const app = getFirebaseApp();
  const fns = getFunctions(app, 'us-central1');
  if (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' &&
    !(globalThis as { __luxFnEmu?: boolean }).__luxFnEmu
  ) {
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
    (globalThis as { __luxFnEmu?: boolean }).__luxFnEmu = true;
  }
  return fns;
}
