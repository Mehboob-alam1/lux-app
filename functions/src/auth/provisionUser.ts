import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { Role } from '@lux/contracts';
import { auth, db } from '../firebase';
import { assertAppCheck } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

type ProvisionInput = {
  role: 'CUSTOMER' | 'DRIVER';
  displayName: string;
  marketIds?: string[];
  consentVersions?: Record<string, string>;
};

/**
 * First-time profile provisioning after Firebase Auth sign-in.
 * Sets custom claims roles array and users/{uid} record.
 */
export const provisionUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = request.auth.uid;
    const data = request.data as ProvisionInput;
    if (data.role !== 'CUSTOMER' && data.role !== 'DRIVER') {
      throw new HttpsError('invalid-argument', 'Invalid role for self-provision');
    }

    const existing = await db.collection('users').doc(uid).get();
    if (existing.exists) {
      return { uid, alreadyProvisioned: true };
    }

    const now = nowIso();
    const roles: Role[] = [data.role];
    const marketIds = data.marketIds?.length ? data.marketIds : ['yyz'];

    await db.collection('users').doc(uid).set({
      uid,
      email: request.auth.token.email ?? null,
      phone: request.auth.token.phone_number ?? null,
      emailVerified: Boolean(request.auth.token.email_verified),
      phoneVerified: Boolean(request.auth.token.phone_number),
      roleIds: roles,
      marketIds,
      accountState: data.role === 'DRIVER' ? 'PENDING' : 'ACTIVE',
      consentVersions: data.consentVersions ?? {},
      createdAt: now,
      updatedAt: now,
    });

    if (data.role === 'CUSTOMER') {
      await db.collection('customer_profiles').doc(uid).set({
        uid,
        displayName: data.displayName,
        preferences: {},
        savedPlaceIds: [],
        notificationSettings: {
          push: true,
          sms: false,
          email: true,
          guardian: false,
        },
        createdAt: now,
        updatedAt: now,
      });
    }

    if (data.role === 'DRIVER') {
      await db.collection('drivers').doc(uid).set({
        uid,
        status: 'PENDING',
        driverType: 'OWNER_DRIVER',
        displayName: data.displayName,
        capabilities: [],
        marketIds,
        currentVehicleId: null,
        onlineState: 'OFFLINE',
        readiness: {},
        payoutAccountReference: null,
        performance: {},
        statusReason: 'Complete onboarding and await review',
        createdAt: now,
        updatedAt: now,
      });
    }

    await auth.setCustomUserClaims(uid, { roles });
    logInfo('user_provisioned', { role: data.role });
    return { uid, roles, alreadyProvisioned: false };
  },
);

/** Emulator/dev only: seed admin claims. Disabled unless ALLOW_ADMIN_BOOTSTRAP=true */
export const bootstrapAdmin = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
      res.status(403).send('Admin bootstrap disabled');
      return;
    }
    const { uid, roles, marketIds } = req.body as {
      uid: string;
      roles: Role[];
      marketIds?: string[];
    };
    if (!uid || !roles?.length) {
      res.status(400).send('uid and roles required');
      return;
    }
    const now = nowIso();
    await db.collection('users').doc(uid).set(
      {
        uid,
        roleIds: roles,
        marketIds: marketIds ?? ['yyz'],
        accountState: 'ACTIVE',
        consentVersions: {},
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    await auth.setCustomUserClaims(uid, { roles });
    res.json({ ok: true, uid, roles });
  },
);
