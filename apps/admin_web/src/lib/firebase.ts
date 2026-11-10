import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const useEmulators =
  process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

export function assertFirebaseConfig() {
  if (!config.apiKey || config.apiKey === 'demo' || !config.projectId) {
    throw new Error(
      'Firebase web config missing. Set NEXT_PUBLIC_FIREBASE_* in apps/admin_web/.env.local',
    );
  }
}

export function getFirebaseApp(): FirebaseApp {
  assertFirebaseConfig();
  return getApps()[0] ?? initializeApp(config);
}

export function getDb(): Firestore {
  const app = getFirebaseApp();
  const db = getFirestore(app);
  if (
    typeof window !== 'undefined' &&
    useEmulators &&
    !(globalThis as { __luxFsEmu?: boolean }).__luxFsEmu
  ) {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    (globalThis as { __luxFsEmu?: boolean }).__luxFsEmu = true;
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  if (
    typeof window !== 'undefined' &&
    useEmulators &&
    !(globalThis as { __luxAuthEmu?: boolean }).__luxAuthEmu
  ) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    (globalThis as { __luxAuthEmu?: boolean }).__luxAuthEmu = true;
  }
  return auth;
}

export function getFirebaseFunctions(): Functions {
  const app = getFirebaseApp();
  const fns = getFunctions(app, 'us-central1');
  if (
    typeof window !== 'undefined' &&
    useEmulators &&
    !(globalThis as { __luxFnEmu?: boolean }).__luxFnEmu
  ) {
    connectFunctionsEmulator(fns, '127.0.0.1', 5001);
    (globalThis as { __luxFnEmu?: boolean }).__luxFnEmu = true;
  }
  return fns;
}

export function getFirebaseStorage(): FirebaseStorage {
  const app = getFirebaseApp();
  const storage = getStorage(app);
  if (
    typeof window !== 'undefined' &&
    useEmulators &&
    !(globalThis as { __luxStorageEmu?: boolean }).__luxStorageEmu
  ) {
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    (globalThis as { __luxStorageEmu?: boolean }).__luxStorageEmu = true;
  }
  return storage;
}

export function firebaseProjectLabel() {
  return `${config.projectId}${useEmulators ? ' · emulators' : ' · live'}`;
}
