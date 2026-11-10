import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requirePermission,
} from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

const Schema = z.object({
  caseId: z.string().min(1),
  status: z.enum([
    'OPEN',
    'PENDING_CUSTOMER',
    'PENDING_INTERNAL',
    'RESOLVED',
    'REOPENED',
    'CLOSED',
  ]),
  notes: z.string().max(500).optional(),
});

export const updateSupportCaseStatus = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'support:write');

    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const ref = db.collection('support_cases').doc(cmd.caseId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Case not found');

    const now = nowIso();
    await ref.set(
      {
        status: cmd.status,
        statusNotes: cmd.notes ?? null,
        statusUpdatedBy: ctx.uid,
        statusUpdatedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    logInfo('support_case_status_updated', {
      caseId: cmd.caseId,
      status: cmd.status,
    });

    return { ok: true, caseId: cmd.caseId, status: cmd.status };
  },
);
