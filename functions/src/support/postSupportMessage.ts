import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

const Schema = z.object({
  caseId: z.string().min(1),
  body: z.string().min(1).max(4000),
  visibility: z.enum(['PUBLIC', 'INTERNAL']).optional(),
});

function isSupportAdmin(roles: string[]) {
  return roles.some((r) =>
    ['ADMIN_SUPPORT', 'ADMIN_SUPER', 'ADMIN_OPERATIONS'].includes(r),
  );
}

/**
 * Append a chat message to a support case (customer or admin).
 */
export const postSupportMessage = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { caseId, body } = parsed.data;
    const admin = isSupportAdmin(ctx.roles);
    const visibility =
      admin && parsed.data.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC';

    const caseRef = db.collection('support_cases').doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) throw new HttpsError('not-found', 'Case not found');
    const supportCase = caseSnap.data()!;

    if (supportCase.ownerUid !== ctx.uid && !admin) {
      throw new HttpsError('permission-denied', 'Not a participant on this case');
    }
    if (supportCase.status === 'CLOSED' && !admin) {
      throw new HttpsError('failed-precondition', 'Case is closed');
    }

    const now = nowIso();
    const messageId = newId('smsg');
    await db.collection('support_messages').doc(messageId).set({
      messageId,
      caseId,
      ownerUid: supportCase.ownerUid,
      authorUid: ctx.uid,
      authorRole: admin ? 'ADMIN' : 'CUSTOMER',
      visibility,
      body: body.trim(),
      createdAt: now,
    });

    const nextStatus = admin
      ? supportCase.status === 'CLOSED'
        ? 'CLOSED'
        : 'PENDING_CUSTOMER'
      : 'PENDING_INTERNAL';

    await caseRef.set(
      {
        status:
          supportCase.status === 'CLOSED' && admin
            ? supportCase.status
            : nextStatus,
        lastMessageAt: now,
        lastMessagePreview: body.trim().slice(0, 120),
        lastAuthorUid: ctx.uid,
        updatedAt: now,
      },
      { merge: true },
    );

    logInfo('support_message_posted', {
      caseId,
      byAdmin: admin,
      visibility,
    });

    return { ok: true, messageId, status: nextStatus };
  },
);
