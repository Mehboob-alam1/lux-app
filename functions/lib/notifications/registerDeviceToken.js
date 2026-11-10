"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDeviceToken = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const Schema = zod_1.z.object({
    token: zod_1.z.string().min(20).max(4096),
    platform: zod_1.z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
    app: zod_1.z.enum(['customer', 'driver', 'admin']).default('customer'),
    active: zod_1.z.boolean().optional(),
});
/**
 * Upsert the caller's FCM device token for push delivery.
 */
exports.registerDeviceToken = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const parsed = Schema.safeParse(request.data ?? {});
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const { token, platform, app } = parsed.data;
    const active = parsed.data.active !== false;
    const now = (0, time_1.nowIso)();
    const tokenHash = (0, crypto_1.createHash)('sha256').update(token).digest('hex').slice(0, 24);
    const docId = `tok_${ctx.uid}_${app}_${tokenHash}`;
    if (!active) {
        await firebase_1.db.collection('device_tokens').doc(docId).set({
            active: false,
            updatedAt: now,
            deactivatedAt: now,
        }, { merge: true });
        (0, logger_1.logInfo)('device_token_deactivated', { uid: ctx.uid, app });
        return { ok: true, tokenId: docId, active: false };
    }
    await firebase_1.db.collection('device_tokens').doc(docId).set({
        tokenId: docId,
        userId: ctx.uid,
        token,
        platform,
        app,
        active: true,
        updatedAt: now,
        createdAt: now,
    }, { merge: true });
    // Deactivate duplicate rows with the same raw token for this user.
    const dupes = await firebase_1.db
        .collection('device_tokens')
        .where('userId', '==', ctx.uid)
        .where('token', '==', token)
        .get();
    const batch = firebase_1.db.batch();
    for (const d of dupes.docs) {
        if (d.id === docId)
            continue;
        batch.set(d.ref, { active: false, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    (0, logger_1.logInfo)('device_token_registered', { uid: ctx.uid, app, platform });
    return { ok: true, tokenId: docId, active: true };
});
//# sourceMappingURL=registerDeviceToken.js.map