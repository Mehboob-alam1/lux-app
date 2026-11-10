import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseFunctions } from './firebase';
import { logError, logInfo } from './logger';

export type AdminAccessResult = {
  ok: boolean;
  roles: string[];
  provisioned?: boolean;
  reason?: string;
};

/**
 * Grant / sync ADMIN_* claims for the signed-in user, then force-refresh the ID token
 * so Firestore rules see roles immediately.
 */
export async function ensureAdminAccess(): Promise<AdminAccessResult> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not signed in');
  }

  try {
    const fn = httpsCallable(getFirebaseFunctions(), 'ensureAdminAccess');
    const res = await fn({});
    const data = res.data as AdminAccessResult;
    await user.getIdToken(true);
    logInfo('admin_access_ok', {
      roles: (data.roles ?? []).join(','),
      reason: data.reason,
    });
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('admin_access_failed', { error: msg });
    throw e;
  }
}

export function isPermissionDeniedMessage(message: string | null | undefined) {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('missing or insufficient permissions') ||
    m.includes('permission-denied') ||
    m.includes('permission_denied')
  );
}
