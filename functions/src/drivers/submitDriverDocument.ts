import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

const Schema = z.object({
  documentId: z.string().min(1),
  storagePath: z.string().min(8).max(500),
  contentType: z
    .string()
    .regex(/^(image\/(jpeg|png|webp)|application\/pdf)$/),
  fileName: z.string().min(1).max(200).optional(),
});

/**
 * Driver marks a checklist document as SUBMITTED after uploading to Storage.
 * Path must be under driver_documents/{uid}/…
 */
export const submitDriverDocument = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);

    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const uid = ctx.uid;
    const prefix = `driver_documents/${uid}/`;
    if (!cmd.storagePath.startsWith(prefix)) {
      throw new HttpsError(
        'permission-denied',
        'storagePath must be under your driver_documents folder',
      );
    }

    const ref = db.collection('driver_documents').doc(cmd.documentId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Document not found');
    const doc = snap.data()!;
    if (doc.driverId !== uid) {
      throw new HttpsError('permission-denied', 'Not your document');
    }
    if (doc.status === 'APPROVED') {
      throw new HttpsError(
        'failed-precondition',
        'Document already approved — contact ops to reopen',
      );
    }

    const now = nowIso();
    await ref.set(
      {
        status: 'SUBMITTED',
        storagePath: cmd.storagePath,
        contentType: cmd.contentType,
        fileName: cmd.fileName ?? cmd.storagePath.split('/').pop() ?? null,
        uploadedAt: now,
        uploadedBy: uid,
        reviewNotes: null,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: now,
      },
      { merge: true },
    );

    // Re-upload after prior eligibility should clear the gate until ops re-approves.
    if (doc.vehicleId) {
      const vehicleRef = db.collection('vehicles').doc(String(doc.vehicleId));
      const vehicleSnap = await vehicleRef.get();
      if (vehicleSnap.exists && vehicleSnap.data()?.documentEligibilityOk) {
        await vehicleRef.set(
          {
            documentEligibilityOk: false,
            documentsReviewNotes: 'Cleared — document re-submitted',
            updatedAt: now,
          },
          { merge: true },
        );
        await db.collection('drivers').doc(uid).set(
          {
            status: 'PENDING',
            statusReason: 'Document re-submitted — awaiting ops review',
            updatedAt: now,
          },
          { merge: true },
        );
      }
    }

    logInfo('driver_document_submitted', {
      documentId: cmd.documentId,
      type: String(doc.type ?? ''),
    });

    return { ok: true, documentId: cmd.documentId, status: 'SUBMITTED' };
  },
);
