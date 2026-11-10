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

const optionalNotes = z
  .union([z.string().max(500), z.null(), z.undefined()])
  .optional()
  .transform((v) => (v == null || v === '' ? undefined : v));

const ReviewVehicleSchema = z.object({
  vehicleId: z.string().min(1),
  decision: z.enum(['APPROVE', 'REJECT']),
  checklist: z
    .object({
      plateVerified: z.boolean(),
      classConfirmed: z.boolean(),
      photosReviewed: z.boolean(),
      inspectionPassed: z.boolean(),
    })
    .optional(),
  notes: optionalNotes,
});

/**
 * Admin vehicle approval. Does not flip documentEligibilityOk —
 * documents are reviewed separately.
 */
export const reviewVehicle = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'vehicle:approve');

    const parsed = ReviewVehicleSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const now = nowIso();

    const ref = db.collection('vehicles').doc(cmd.vehicleId);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Vehicle not found');
    const vehicle = snap.data()!;

    if (cmd.decision === 'APPROVE') {
      const c = cmd.checklist;
      if (
        !c ||
        !c.plateVerified ||
        !c.classConfirmed ||
        !c.photosReviewed ||
        !c.inspectionPassed
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Complete the full vehicle checklist before approving',
        );
      }
    }

    const status = cmd.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const inspectionStatus =
      cmd.decision === 'APPROVE'
        ? 'PASSED'
        : cmd.checklist?.inspectionPassed === false
          ? 'FAILED'
          : vehicle.inspectionStatus ?? 'PENDING';

    await ref.set(
      {
        status,
        inspectionStatus,
        reviewChecklist: cmd.checklist ?? vehicle.reviewChecklist ?? null,
        reviewNotes: cmd.notes ?? null,
        reviewedBy: ctx.uid,
        reviewedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    const driverId = vehicle.ownerDriverId as string | undefined;
    let driverStatus: string | null = null;
    if (driverId && cmd.decision === 'APPROVE') {
      driverStatus = await maybeActivateDriver(driverId);
    }
    if (driverId && cmd.decision === 'REJECT') {
      await db.collection('drivers').doc(driverId).set(
        {
          status: 'PENDING',
          statusReason: cmd.notes?.trim() || 'Vehicle rejected — resubmit',
          updatedAt: now,
        },
        { merge: true },
      );
      driverStatus = 'PENDING';
    }

    logInfo('vehicle_reviewed', {
      vehicleId: cmd.vehicleId,
      decision: cmd.decision,
      reviewer: ctx.uid.slice(0, 8),
    });

    return {
      ok: true,
      vehicleId: cmd.vehicleId,
      status,
      driverStatus,
    };
  },
);
