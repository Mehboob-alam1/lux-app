"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMyProfile = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/**
 * Self-service profile update. Never changes roles/eligibility.
 */
exports.updateMyProfile = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const data = (request.data ?? {});
    const now = (0, time_1.nowIso)();
    const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : undefined;
    if (displayName !== undefined && displayName.length < 2) {
        throw new https_1.HttpsError('invalid-argument', 'Name looks too short.');
    }
    const phone = data.phone === null
        ? null
        : typeof data.phone === 'string'
            ? data.phone.trim() || null
            : undefined;
    if (displayName) {
        await firebase_1.auth.updateUser(ctx.uid, { displayName });
    }
    await firebase_1.db.collection('users').doc(ctx.uid).set({
        ...(phone !== undefined ? { phone } : {}),
        updatedAt: now,
    }, { merge: true });
    const isDriver = ctx.roles.includes('DRIVER');
    const isCustomer = ctx.roles.includes('CUSTOMER') || (!isDriver && ctx.roles.length === 0);
    if (isCustomer || ctx.roles.includes('CUSTOMER')) {
        const notif = {};
        if (typeof data.pushNotifications === 'boolean') {
            notif.push = data.pushNotifications;
        }
        if (typeof data.emailNotifications === 'boolean') {
            notif.email = data.emailNotifications;
        }
        if (typeof data.smsNotifications === 'boolean') {
            notif.sms = data.smsNotifications;
        }
        await firebase_1.db.collection('customer_profiles').doc(ctx.uid).set({
            ...(displayName ? { displayName } : {}),
            ...(typeof data.preferredLanguage === 'string'
                ? { preferredLanguage: data.preferredLanguage.trim() || 'en' }
                : {}),
            ...(Object.keys(notif).length
                ? { notificationSettings: notif }
                : {}),
            updatedAt: now,
        }, { merge: true });
    }
    if (isDriver) {
        await firebase_1.db.collection('drivers').doc(ctx.uid).set({
            ...(displayName ? { displayName } : {}),
            updatedAt: now,
        }, { merge: true });
    }
    (0, logger_1.logInfo)('profile_updated', {
        uid: ctx.uid.slice(0, 8),
        role: isDriver ? 'DRIVER' : 'CUSTOMER',
    });
    return { ok: true, updatedAt: now };
});
//# sourceMappingURL=updateMyProfile.js.map