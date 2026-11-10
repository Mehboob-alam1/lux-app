import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { Role } from '@lux/contracts';
import { auth, db } from '../firebase';
import { assertAppCheck } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo, logWarn } from '../util/logger';

const ADMIN_ROLES: Role[] = [
  'ADMIN_SUPER',
  'ADMIN_OPERATIONS',
  'ADMIN_DISPATCHER',
  'ADMIN_SUPPORT',
  'ADMIN_FINANCE',
  'ADMIN_COMPLIANCE',
  'ADMIN_SAFETY',
  'ADMIN_READ_ONLY',
];

function parseAllowlist(): string[] {
  return (process.env.ADMIN_EMAIL_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function hasAdminRole(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => ADMIN_ROLES.includes(r as Role));
}

/**
 * Ensures the signed-in user has admin claims + users/{uid} for the ops console.
 *
 * Grant path (first match wins):
 * 1) users/{uid} already has an ADMIN_* role → sync Auth claims
 * 2) email is on ADMIN_EMAIL_ALLOWLIST
 * 3) no ADMIN_SUPER exists yet → first ops user becomes ADMIN_SUPER
 * 4) ALLOW_ADMIN_SELF_PROVISION=true → any signed-in email gets ADMIN_SUPER (demo)
 */
export const ensureAdminAccess = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const uid = request.auth.uid;
    const email = String(request.auth.token.email ?? '')
      .trim()
      .toLowerCase();
    const now = nowIso();
    const allowlist = parseAllowlist();
    // Demo-friendly: open self-provision unless explicitly disabled.
    // Lock down later with ALLOW_ADMIN_SELF_PROVISION=false + ADMIN_EMAIL_ALLOWLIST.
    const selfProvision = process.env.ALLOW_ADMIN_SELF_PROVISION !== 'false';

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const existingRoles = (userSnap.data()?.roleIds as Role[] | undefined) ?? [];

    if (hasAdminRole(existingRoles)) {
      await auth.setCustomUserClaims(uid, { roles: existingRoles });
      if (userSnap.data()?.accountState !== 'ACTIVE') {
        await userRef.set(
          { accountState: 'ACTIVE', updatedAt: now },
          { merge: true },
        );
      }
      logInfo('admin_access_synced', { uid: uid.slice(0, 8) });
      return {
        ok: true,
        roles: existingRoles,
        provisioned: false,
        reason: 'existing_admin',
      };
    }

    let grant = false;
    let reason = '';

    if (email && allowlist.includes(email)) {
      grant = true;
      reason = 'allowlist';
    } else if (selfProvision) {
      grant = true;
      reason = 'self_provision';
    } else {
      const existingAdmin = await db
        .collection('users')
        .where('roleIds', 'array-contains', 'ADMIN_SUPER')
        .limit(1)
        .get();
      if (existingAdmin.empty) {
        grant = true;
        reason = 'first_admin';
      }
    }

    if (!grant) {
      logWarn('admin_access_denied', {
        uid: uid.slice(0, 8),
        hasEmail: Boolean(email),
      });
      throw new HttpsError(
        'permission-denied',
        'This account is not authorized for the admin console. Ask an existing ADMIN_SUPER to grant access, or set ADMIN_EMAIL_ALLOWLIST / ALLOW_ADMIN_SELF_PROVISION on Functions.',
      );
    }

    const roles: Role[] = ['ADMIN_SUPER'];
    const marketIds = ['yyz'];

    await userRef.set(
      {
        uid,
        email: email || null,
        phone: request.auth.token.phone_number ?? null,
        emailVerified: Boolean(request.auth.token.email_verified),
        phoneVerified: Boolean(request.auth.token.phone_number),
        roleIds: roles,
        marketIds,
        accountState: 'ACTIVE',
        consentVersions: userSnap.data()?.consentVersions ?? {},
        createdAt: userSnap.data()?.createdAt ?? now,
        updatedAt: now,
      },
      { merge: true },
    );
    await auth.setCustomUserClaims(uid, { roles });

    logInfo('admin_access_granted', {
      uid: uid.slice(0, 8),
      reason,
    });

    return { ok: true, roles, provisioned: true, reason };
  },
);
