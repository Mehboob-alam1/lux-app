"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewVehicle = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const eligibilityActivation_1 = require("./eligibilityActivation");
const optionalNotes = zod_1.z
    .union([zod_1.z.string().max(500), zod_1.z.null(), zod_1.z.undefined()])
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v));
const ReviewVehicleSchema = zod_1.z.object({
    vehicleId: zod_1.z.string().min(1),
    decision: zod_1.z.enum(['APPROVE', 'REJECT']),
    checklist: zod_1.z
        .object({
        plateVerified: zod_1.z.boolean(),
        classConfirmed: zod_1.z.boolean(),
        photosReviewed: zod_1.z.boolean(),
        inspectionPassed: zod_1.z.boolean(),
    })
        .optional(),
    notes: optionalNotes,
});
/**
 * Admin vehicle approval. Does not flip documentEligibilityOk —
 * documents are reviewed separately.
 */
exports.reviewVehicle = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'vehicle:approve');
    const parsed = ReviewVehicleSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const now = (0, time_1.nowIso)();
    const ref = firebase_1.db.collection('vehicles').doc(cmd.vehicleId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Vehicle not found');
    const vehicle = snap.data();
    if (cmd.decision === 'APPROVE') {
        const c = cmd.checklist;
        if (!c ||
            !c.plateVerified ||
            !c.classConfirmed ||
            !c.photosReviewed ||
            !c.inspectionPassed) {
            throw new https_1.HttpsError('failed-precondition', 'Complete the full vehicle checklist before approving');
        }
    }
    const status = cmd.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const inspectionStatus = cmd.decision === 'APPROVE'
        ? 'PASSED'
        : cmd.checklist?.inspectionPassed === false
            ? 'FAILED'
            : vehicle.inspectionStatus ?? 'PENDING';
    await ref.set({
        status,
        inspectionStatus,
        reviewChecklist: cmd.checklist ?? vehicle.reviewChecklist ?? null,
        reviewNotes: cmd.notes ?? null,
        reviewedBy: ctx.uid,
        reviewedAt: now,
        updatedAt: now,
    }, { merge: true });
    const driverId = vehicle.ownerDriverId;
    let driverStatus = null;
    if (driverId && cmd.decision === 'APPROVE') {
        driverStatus = await (0, eligibilityActivation_1.maybeActivateDriver)(driverId);
    }
    if (driverId && cmd.decision === 'REJECT') {
        await firebase_1.db.collection('drivers').doc(driverId).set({
            status: 'PENDING',
            statusReason: cmd.notes?.trim() || 'Vehicle rejected — resubmit',
            updatedAt: now,
        }, { merge: true });
        driverStatus = 'PENDING';
    }
    (0, logger_1.logInfo)('vehicle_reviewed', {
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
});
//# sourceMappingURL=reviewVehicle.js.map