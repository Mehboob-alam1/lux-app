"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeDocumentEligibility = exports.reviewDriverDocument = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const eligibilityActivation_1 = require("./eligibilityActivation");
const documentChecklist_1 = require("./documentChecklist");
const optionalNotes = zod_1.z
    .union([zod_1.z.string().max(500), zod_1.z.null(), zod_1.z.undefined()])
    .optional()
    .transform((v) => (v == null || v === '' ? undefined : v));
const ReviewOneSchema = zod_1.z.object({
    documentId: zod_1.z.string().min(1),
    decision: zod_1.z.enum(['APPROVE', 'REJECT']),
    notes: optionalNotes,
});
const FinalizeDocsSchema = zod_1.z.object({
    driverId: zod_1.z.string().min(1),
    vehicleId: zod_1.z.string().min(1),
    decision: zod_1.z.enum(['APPROVE_ELIGIBILITY', 'REVOKE_ELIGIBILITY']),
    notes: optionalNotes,
});
/**
 * Approve/reject a single checklist document.
 */
exports.reviewDriverDocument = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'document:review');
    const parsed = ReviewOneSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const now = (0, time_1.nowIso)();
    const ref = firebase_1.db.collection('driver_documents').doc(cmd.documentId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Document not found');
    const existing = snap.data();
    if (cmd.decision === 'APPROVE') {
        if (existing.status !== 'SUBMITTED' || !existing.storagePath) {
            throw new https_1.HttpsError('failed-precondition', 'Driver must upload the file before approval');
        }
    }
    const status = cmd.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    await ref.set({
        status,
        reviewNotes: cmd.notes ?? null,
        reviewedBy: ctx.uid,
        reviewedAt: now,
        updatedAt: now,
    }, { merge: true });
    (0, logger_1.logInfo)('driver_document_reviewed', {
        documentId: cmd.documentId,
        decision: cmd.decision,
    });
    return { ok: true, documentId: cmd.documentId, status };
});
/**
 * Flip vehicle.documentEligibilityOk only when every required doc is APPROVED
 * (or explicitly revoke).
 */
exports.finalizeDocumentEligibility = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'document:review');
    const parsed = FinalizeDocsSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const now = (0, time_1.nowIso)();
    const vehicleRef = firebase_1.db.collection('vehicles').doc(cmd.vehicleId);
    const vehicleSnap = await vehicleRef.get();
    if (!vehicleSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Vehicle not found');
    }
    const vehicle = vehicleSnap.data();
    if (vehicle.ownerDriverId !== cmd.driverId) {
        throw new https_1.HttpsError('failed-precondition', 'Vehicle does not belong to driver');
    }
    if (cmd.decision === 'APPROVE_ELIGIBILITY') {
        const docs = await firebase_1.db
            .collection('driver_documents')
            .where('driverId', '==', cmd.driverId)
            .where('vehicleId', '==', cmd.vehicleId)
            .get();
        const byType = new Map();
        for (const d of docs.docs) {
            const data = d.data();
            byType.set(String(data.type), String(data.status));
        }
        const missing = documentChecklist_1.REQUIRED_DOC_TYPES.filter((t) => byType.get(t) !== 'APPROVED');
        if (missing.length) {
            throw new https_1.HttpsError('failed-precondition', `Required documents not approved: ${missing.join(', ')}`);
        }
        await vehicleRef.set({
            documentEligibilityOk: true,
            documentsReviewedBy: ctx.uid,
            documentsReviewedAt: now,
            documentsReviewNotes: cmd.notes ?? null,
            updatedAt: now,
        }, { merge: true });
        const driverStatus = await (0, eligibilityActivation_1.maybeActivateDriver)(cmd.driverId);
        (0, logger_1.logInfo)('document_eligibility_approved', {
            driverId: cmd.driverId.slice(0, 8),
            vehicleId: cmd.vehicleId,
        });
        return {
            ok: true,
            documentEligibilityOk: true,
            driverStatus,
        };
    }
    await vehicleRef.set({
        documentEligibilityOk: false,
        documentsReviewedBy: ctx.uid,
        documentsReviewedAt: now,
        documentsReviewNotes: cmd.notes ?? 'Eligibility revoked',
        updatedAt: now,
    }, { merge: true });
    await firebase_1.db.collection('drivers').doc(cmd.driverId).set({
        status: 'PENDING',
        statusReason: cmd.notes?.trim() || 'Document eligibility revoked',
        updatedAt: now,
    }, { merge: true });
    (0, logger_1.logInfo)('document_eligibility_revoked', {
        driverId: cmd.driverId.slice(0, 8),
        vehicleId: cmd.vehicleId,
    });
    return { ok: true, documentEligibilityOk: false, driverStatus: 'PENDING' };
});
//# sourceMappingURL=reviewDocuments.js.map