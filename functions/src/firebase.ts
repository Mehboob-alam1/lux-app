import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // Already initialized in hot-reload / long-lived emulator workers.
}
export const auth = admin.auth();
export const storage = admin.storage();
export { admin };
