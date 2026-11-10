"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSupportCaseStatus = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const Schema = zod_1.z.object({
    caseId: zod_1.z.string().min(1),
    status: zod_1.z.enum([
        'OPEN',
        'PENDING_CUSTOMER',
        'PENDING_INTERNAL',
        'RESOLVED',
        'REOPENED',
        'CLOSED',
    ]),
    notes: zod_1.z.string().max(500).optional(),
});
exports.updateSupportCaseStatus = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'support:write');
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    const ref = firebase_1.db.collection('support_cases').doc(cmd.caseId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Case not found');
    const now = (0, time_1.nowIso)();
    await ref.set({
        status: cmd.status,
        statusNotes: cmd.notes ?? null,
        statusUpdatedBy: ctx.uid,
        statusUpdatedAt: now,
        updatedAt: now,
    }, { merge: true });
    (0, logger_1.logInfo)('support_case_status_updated', {
        caseId: cmd.caseId,
        status: cmd.status,
    });
    return { ok: true, caseId: cmd.caseId, status: cmd.status };
});
//# sourceMappingURL=updateSupportCaseStatus.js.map