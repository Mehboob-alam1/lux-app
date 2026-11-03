"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapAdmin = exports.provisionUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/**
 * First-time profile provisioning after Firebase Auth sign-in.
 * Sets custom claims roles array and users/{uid} record.
 */
exports.provisionUser = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = request.auth.uid;
    const data = request.data;
    if (data.role !== 'CUSTOMER' && data.role !== 'DRIVER') {
        throw new https_1.HttpsError('invalid-argument', 'Invalid role for self-provision');
    }
    const existing = await firebase_1.db.collection('users').doc(uid).get();
    if (existing.exists) {
        return { uid, alreadyProvisioned: true };
    }
    const now = (0, time_1.nowIso)();
    const roles = [data.role];
    const marketIds = data.marketIds?.length ? data.marketIds : ['yyz'];
    await firebase_1.db.collection('users').doc(uid).set({
        uid,
        email: request.auth.token.email ?? null,
        phone: request.auth.token.phone_number ?? null,
        emailVerified: Boolean(request.auth.token.email_verified),
        phoneVerified: Boolean(request.auth.token.phone_number),
        roleIds: roles,
        marketIds,
        accountState: data.role === 'DRIVER' ? 'PENDING' : 'ACTIVE',
        consentVersions: data.consentVersions ?? {},
        createdAt: now,
        updatedAt: now,
    });
    if (data.role === 'CUSTOMER') {
        await firebase_1.db.collection('customer_profiles').doc(uid).set({
            uid,
            displayName: data.displayName,
            preferences: {},
            savedPlaceIds: [],
            notificationSettings: {
                push: true,
                sms: false,
                email: true,
                guardian: false,
            },
            createdAt: now,
            updatedAt: now,
        });
    }
    if (data.role === 'DRIVER') {
        await firebase_1.db.collection('drivers').doc(uid).set({
            uid,
            status: 'PENDING',
            driverType: 'OWNER_DRIVER',
            displayName: data.displayName,
            capabilities: [],
            marketIds,
            currentVehicleId: null,
            onlineState: 'OFFLINE',
            readiness: {},
            payoutAccountReference: null,
            performance: {},
            statusReason: 'Complete onboarding and await review',
            createdAt: now,
            updatedAt: now,
        });
    }
    await firebase_1.auth.setCustomUserClaims(uid, { roles });
    (0, logger_1.logInfo)('user_provisioned', { role: data.role });
    return { uid, roles, alreadyProvisioned: false };
});
/** Emulator/dev only: seed admin claims. Disabled unless ALLOW_ADMIN_BOOTSTRAP=true */
exports.bootstrapAdmin = (0, https_2.onRequest)({ region: 'us-central1' }, async (req, res) => {
    if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
        res.status(403).send('Admin bootstrap disabled');
        return;
    }
    const { uid, roles, marketIds } = req.body;
    if (!uid || !roles?.length) {
        res.status(400).send('uid and roles required');
        return;
    }
    const now = (0, time_1.nowIso)();
    await firebase_1.db.collection('users').doc(uid).set({
        uid,
        roleIds: roles,
        marketIds: marketIds ?? ['yyz'],
        accountState: 'ACTIVE',
        consentVersions: {},
        createdAt: now,
        updatedAt: now,
    }, { merge: true });
    await firebase_1.auth.setCustomUserClaims(uid, { roles });
    res.json({ ok: true, uid, roles });
});
//# sourceMappingURL=provisionUser.js.map