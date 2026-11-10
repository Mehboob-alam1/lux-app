import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth, db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

type UpdateInput = {
  displayName?: string;
  phone?: string | null;
  preferredLanguage?: string;
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
};

/**
 * Self-service profile update. Never changes roles/eligibility.
 */
export const updateMyProfile = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const data = (request.data ?? {}) as UpdateInput;
    const now = nowIso();

    const displayName =
      typeof data.displayName === 'string' ? data.displayName.trim() : undefined;
    if (displayName !== undefined && displayName.length < 2) {
      throw new HttpsError('invalid-argument', 'Name looks too short.');
    }

    const phone =
      data.phone === null
        ? null
        : typeof data.phone === 'string'
          ? data.phone.trim() || null
          : undefined;

    if (displayName) {
      await auth.updateUser(ctx.uid, { displayName });
    }

    await db.collection('users').doc(ctx.uid).set(
      {
        ...(phone !== undefined ? { phone } : {}),
        updatedAt: now,
      },
      { merge: true },
    );

    const isDriver = ctx.roles.includes('DRIVER');
    const isCustomer =
      ctx.roles.includes('CUSTOMER') || (!isDriver && ctx.roles.length === 0);

    if (isCustomer || ctx.roles.includes('CUSTOMER')) {
      const notif: Record<string, boolean> = {};
      if (typeof data.pushNotifications === 'boolean') {
        notif.push = data.pushNotifications;
      }
      if (typeof data.emailNotifications === 'boolean') {
        notif.email = data.emailNotifications;
      }
      if (typeof data.smsNotifications === 'boolean') {
        notif.sms = data.smsNotifications;
      }
      await db.collection('customer_profiles').doc(ctx.uid).set(
        {
          ...(displayName ? { displayName } : {}),
          ...(typeof data.preferredLanguage === 'string'
            ? { preferredLanguage: data.preferredLanguage.trim() || 'en' }
            : {}),
          ...(Object.keys(notif).length
            ? { notificationSettings: notif }
            : {}),
          updatedAt: now,
        },
        { merge: true },
      );
    }

    if (isDriver) {
      await db.collection('drivers').doc(ctx.uid).set(
        {
          ...(displayName ? { displayName } : {}),
          updatedAt: now,
        },
        { merge: true },
      );
    }

    logInfo('profile_updated', {
      uid: ctx.uid.slice(0, 8),
      role: isDriver ? 'DRIVER' : 'CUSTOMER',
    });

    return { ok: true, updatedAt: now };
  },
);
