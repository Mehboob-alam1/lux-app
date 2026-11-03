"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
exports.notifyBookingEvent = notifyBookingEvent;
const firebase_1 = require("../firebase");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/**
 * Push primary via FCM when tokens exist; SMS/email fallback only if configured.
 * Never pretends delivery succeeded without an attempt log.
 */
async function sendNotification(input) {
    const notificationId = (0, ids_1.newId)('ntf');
    const now = (0, time_1.nowIso)();
    const attempts = [];
    const tokens = await firebase_1.db
        .collection('device_tokens')
        .where('userId', '==', input.userId)
        .where('active', '==', true)
        .limit(10)
        .get();
    if (!tokens.empty) {
        // FCM send would use admin.messaging() when credentials present
        const hasCreds = Boolean(process.env.GCLOUD_PROJECT);
        const status = hasCreds ? 'QUEUED_FCM' : 'SKIPPED_NO_FCM_RUNTIME';
        attempts.push({ channel: 'FCM', status });
        for (const t of tokens.docs) {
            const attemptId = (0, ids_1.newId)('nta');
            await firebase_1.db.collection('notification_attempts').doc(attemptId).set({
                attemptId,
                notificationId,
                channel: 'FCM',
                tokenId: t.id,
                status,
                createdAt: now,
            });
        }
    }
    else {
        attempts.push({ channel: 'FCM', status: 'NO_DEVICE_TOKEN' });
    }
    if (input.critical) {
        if (process.env.SMS_API_KEY && process.env.SMS_PROVIDER) {
            attempts.push({ channel: 'SMS', status: 'QUEUED' });
            await firebase_1.db.collection('notification_attempts').doc((0, ids_1.newId)('nta')).set({
                notificationId,
                channel: 'SMS',
                status: 'QUEUED',
                provider: process.env.SMS_PROVIDER,
                createdAt: now,
            });
        }
        else {
            attempts.push({ channel: 'SMS', status: 'SKIPPED_NOT_CONFIGURED' });
        }
        if (process.env.EMAIL_API_KEY && process.env.EMAIL_PROVIDER) {
            attempts.push({ channel: 'EMAIL', status: 'QUEUED' });
            await firebase_1.db.collection('notification_attempts').doc((0, ids_1.newId)('nta')).set({
                notificationId,
                channel: 'EMAIL',
                status: 'QUEUED',
                provider: process.env.EMAIL_PROVIDER,
                createdAt: now,
            });
        }
        else {
            attempts.push({ channel: 'EMAIL', status: 'SKIPPED_NOT_CONFIGURED' });
        }
    }
    await firebase_1.db.collection('notifications').doc(notificationId).set({
        notificationId,
        userId: input.userId,
        template: input.template,
        title: input.title,
        body: input.body,
        bookingId: input.bookingId ?? null,
        critical: Boolean(input.critical),
        attempts,
        createdAt: now,
    });
    (0, logger_1.logInfo)('notification_recorded', {
        notificationId,
        template: input.template,
        attemptCount: attempts.length,
    });
    return { notificationId, attempts };
}
async function notifyBookingEvent(input) {
    try {
        await sendNotification({
            userId: input.userId,
            bookingId: input.bookingId,
            template: input.template,
            title: input.title,
            body: input.body,
            critical: input.critical,
        });
    }
    catch (e) {
        (0, logger_1.logError)('notification_failed', {
            bookingId: input.bookingId,
            template: input.template,
        });
    }
}
//# sourceMappingURL=adapter.js.map