import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { createHash } from 'crypto';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

const Schema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  app: z.enum(['customer', 'driver', 'admin']).default('customer'),
  active: z.boolean().optional(),
});

/**
 * Upsert the caller's FCM device token for push delivery.
 */
export const registerDeviceToken = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const parsed = Schema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { token, platform, app } = parsed.data;
    const active = parsed.data.active !== false;
    const now = nowIso();
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 24);
    const docId = `tok_${ctx.uid}_${app}_${tokenHash}`;

    if (!active) {
      await db.collection('device_tokens').doc(docId).set(
        {
          active: false,
          updatedAt: now,
          deactivatedAt: now,
        },
        { merge: true },
      );
      logInfo('device_token_deactivated', { uid: ctx.uid, app });
      return { ok: true, tokenId: docId, active: false };
    }

    await db.collection('device_tokens').doc(docId).set(
      {
        tokenId: docId,
        userId: ctx.uid,
        token,
        platform,
        app,
        active: true,
        updatedAt: now,
        createdAt: now,
      },
      { merge: true },
    );

    // Deactivate duplicate rows with the same raw token for this user.
    const dupes = await db
      .collection('device_tokens')
      .where('userId', '==', ctx.uid)
      .where('token', '==', token)
      .get();
    const batch = db.batch();
    for (const d of dupes.docs) {
      if (d.id === docId) continue;
      batch.set(d.ref, { active: false, updatedAt: now }, { merge: true });
    }
    await batch.commit();

    logInfo('device_token_registered', { uid: ctx.uid, app, platform });
    return { ok: true, tokenId: docId, active: true };
  },
);
