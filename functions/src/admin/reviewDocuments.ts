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
import { maybeActivateDriver } from './eligibilityActivation';
import { REQUIRED_DOC_TYPES } from './documentChecklist';

const optionalNotes = z
  .union([z.string().max(500), z.null(), z.undefined()])
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : v));

const ReviewOneSchema = z.object({
  documentId: z.string().min(1),
  decision: z.enum(['APPROVE', 'REJECT']),
  notes: optionalNotes,
});

const FinalizeDocsSchema = z.object({
  driverId: z.string().min(1),
  vehicleId: z.string().min(1),
  decision: z.enum(['APPROVE_ELIGIBILITY', 'REVOKE_ELIGIBILITY']),
  notes: optionalNotes,
});

/**
 * Approve/reject a single checklist document.
 */
export const reviewDriverDocument = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'document:review');

    const parsed = ReviewOneSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const now = nowIso();
    const ref = db.collection('driver_documents').doc(cmd.documentId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Document not found');
    const existing = snap.data()!;

    if (cmd.decision === 'APPROVE') {
      if (existing.status !== 'SUBMITTED' || !existing.storagePath) {
        throw new HttpsError(
          'failed-precondition',
          'Driver must upload the file before approval',
        );
      }
    }

    const status = cmd.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await ref.set(
      {
        status,
        reviewNotes: cmd.notes ?? null,
        reviewedBy: ctx.uid,
        reviewedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    logInfo('driver_document_reviewed', {
      documentId: cmd.documentId,
      decision: cmd.decision,
    });

    return { ok: true, documentId: cmd.documentId, status };
  },
);

/**
 * Flip vehicle.documentEligibilityOk only when every required doc is APPROVED
 * (or explicitly revoke).
 */
export const finalizeDocumentEligibility = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'document:review');

    const parsed = FinalizeDocsSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const now = nowIso();

    const vehicleRef = db.collection('vehicles').doc(cmd.vehicleId);
    const vehicleSnap = await vehicleRef.get();
    if (!vehicleSnap.exists) {
      throw new HttpsError('not-found', 'Vehicle not found');
    }
    const vehicle = vehicleSnap.data()!;
    if (vehicle.ownerDriverId !== cmd.driverId) {
      throw new HttpsError(
        'failed-precondition',
        'Vehicle does not belong to driver',
      );
    }

    if (cmd.decision === 'APPROVE_ELIGIBILITY') {
      const docs = await db
        .collection('driver_documents')
        .where('driverId', '==', cmd.driverId)
        .where('vehicleId', '==', cmd.vehicleId)
        .get();

      const byType = new Map<string, string>();
      for (const d of docs.docs) {
        const data = d.data();
        byType.set(String(data.type), String(data.status));
      }
      const missing = REQUIRED_DOC_TYPES.filter(
        (t) => byType.get(t) !== 'APPROVED',
      );
      if (missing.length) {
        throw new HttpsError(
          'failed-precondition',
          `Required documents not approved: ${missing.join(', ')}`,
        );
      }

      await vehicleRef.set(
        {
          documentEligibilityOk: true,
          documentsReviewedBy: ctx.uid,
          documentsReviewedAt: now,
          documentsReviewNotes: cmd.notes ?? null,
          updatedAt: now,
        },
        { merge: true },
      );

      const driverStatus = await maybeActivateDriver(cmd.driverId);
      logInfo('document_eligibility_approved', {
        driverId: cmd.driverId.slice(0, 8),
        vehicleId: cmd.vehicleId,
      });
      return {
        ok: true,
        documentEligibilityOk: true,
        driverStatus,
      };
    }

    await vehicleRef.set(
      {
        documentEligibilityOk: false,
        documentsReviewedBy: ctx.uid,
        documentsReviewedAt: now,
        documentsReviewNotes: cmd.notes ?? 'Eligibility revoked',
        updatedAt: now,
      },
      { merge: true },
    );
    await db.collection('drivers').doc(cmd.driverId).set(
      {
        status: 'PENDING',
        statusReason: cmd.notes?.trim() || 'Document eligibility revoked',
        updatedAt: now,
      },
      { merge: true },
    );

    logInfo('document_eligibility_revoked', {
      driverId: cmd.driverId.slice(0, 8),
      vehicleId: cmd.vehicleId,
    });
    return { ok: true, documentEligibilityOk: false, driverStatus: 'PENDING' };
  },
);
