"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSupportMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const Schema = zod_1.z.object({
    caseId: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1).max(4000),
    visibility: zod_1.z.enum(['PUBLIC', 'INTERNAL']).optional(),
});
function isSupportAdmin(roles) {
    return roles.some((r) => ['ADMIN_SUPPORT', 'ADMIN_SUPER', 'ADMIN_OPERATIONS'].includes(r));
}
/**
 * Append a chat message to a support case (customer or admin).
 */
exports.postSupportMessage = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const { caseId, body } = parsed.data;
    const admin = isSupportAdmin(ctx.roles);
    const visibility = admin && parsed.data.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLIC';
    const caseRef = firebase_1.db.collection('support_cases').doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists)
        throw new https_1.HttpsError('not-found', 'Case not found');
    const supportCase = caseSnap.data();
    if (supportCase.ownerUid !== ctx.uid && !admin) {
        throw new https_1.HttpsError('permission-denied', 'Not a participant on this case');
    }
    if (supportCase.status === 'CLOSED' && !admin) {
        throw new https_1.HttpsError('failed-precondition', 'Case is closed');
    }
    const now = (0, time_1.nowIso)();
    const messageId = (0, ids_1.newId)('smsg');
    const authorRole = admin
        ? 'ADMIN'
        : ctx.roles.includes('DRIVER')
            ? 'DRIVER'
            : 'CUSTOMER';
    await firebase_1.db.collection('support_messages').doc(messageId).set({
        messageId,
        caseId,
        ownerUid: supportCase.ownerUid,
        authorUid: ctx.uid,
        authorRole,
        visibility,
        body: body.trim(),
        createdAt: now,
    });
    const nextStatus = admin
        ? supportCase.status === 'CLOSED'
            ? 'CLOSED'
            : 'PENDING_CUSTOMER'
        : 'PENDING_INTERNAL';
    await caseRef.set({
        status: supportCase.status === 'CLOSED' && admin
            ? supportCase.status
            : nextStatus,
        lastMessageAt: now,
        lastMessagePreview: body.trim().slice(0, 120),
        lastAuthorUid: ctx.uid,
        updatedAt: now,
    }, { merge: true });
    (0, logger_1.logInfo)('support_message_posted', {
        caseId,
        byAdmin: admin,
        visibility,
    });
    return { ok: true, messageId, status: nextStatus };
});
//# sourceMappingURL=postSupportMessage.js.map