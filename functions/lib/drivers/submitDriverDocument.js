"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDriverDocument = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const Schema = zod_1.z.object({
    documentId: zod_1.z.string().min(1),
    storagePath: zod_1.z.string().min(8).max(500),
    contentType: zod_1.z
        .string()
        .regex(/^(image\/(jpeg|png|webp)|application\/pdf)$/),
    fileName: zod_1.z.string().min(1).max(200).optional(),
});
/**
 * Driver marks a checklist document as SUBMITTED after uploading to Storage.
 * Path must be under driver_documents/{uid}/…
 */
exports.submitDriverDocument = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const uid = ctx.uid;
    const prefix = `driver_documents/${uid}/`;
    if (!cmd.storagePath.startsWith(prefix)) {
        throw new https_1.HttpsError('permission-denied', 'storagePath must be under your driver_documents folder');
    }
    const ref = firebase_1.db.collection('driver_documents').doc(cmd.documentId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Document not found');
    const doc = snap.data();
    if (doc.driverId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Not your document');
    }
    if (doc.status === 'APPROVED') {
        throw new https_1.HttpsError('failed-precondition', 'Document already approved — contact ops to reopen');
    }
    const now = (0, time_1.nowIso)();
    await ref.set({
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
    }, { merge: true });
    // Re-upload after prior eligibility should clear the gate until ops re-approves.
    if (doc.vehicleId) {
        const vehicleRef = firebase_1.db.collection('vehicles').doc(String(doc.vehicleId));
        const vehicleSnap = await vehicleRef.get();
        if (vehicleSnap.exists && vehicleSnap.data()?.documentEligibilityOk) {
            await vehicleRef.set({
                documentEligibilityOk: false,
                documentsReviewNotes: 'Cleared — document re-submitted',
                updatedAt: now,
            }, { merge: true });
            await firebase_1.db.collection('drivers').doc(uid).set({
                status: 'PENDING',
                statusReason: 'Document re-submitted — awaiting ops review',
                updatedAt: now,
            }, { merge: true });
        }
    }
    (0, logger_1.logInfo)('driver_document_submitted', {
        documentId: cmd.documentId,
        type: String(doc.type ?? ''),
    });
    return { ok: true, documentId: cmd.documentId, status: 'SUBMITTED' };
});
//# sourceMappingURL=submitDriverDocument.js.map