"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureAdminAccess = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const ADMIN_ROLES = [
    'ADMIN_SUPER',
    'ADMIN_OPERATIONS',
    'ADMIN_DISPATCHER',
    'ADMIN_SUPPORT',
    'ADMIN_FINANCE',
    'ADMIN_COMPLIANCE',
    'ADMIN_SAFETY',
    'ADMIN_READ_ONLY',
];
function parseAllowlist() {
    return (process.env.ADMIN_EMAIL_ALLOWLIST ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}
function hasAdminRole(roles) {
    if (!Array.isArray(roles))
        return false;
    return roles.some((r) => ADMIN_ROLES.includes(r));
}
/**
 * Ensures the signed-in user has admin claims + users/{uid} for the ops console.
 *
 * Grant path (first match wins):
 * 1) users/{uid} already has an ADMIN_* role → sync Auth claims
 * 2) email is on ADMIN_EMAIL_ALLOWLIST
 * 3) no ADMIN_SUPER exists yet → first ops user becomes ADMIN_SUPER
 * 4) ALLOW_ADMIN_SELF_PROVISION=true → any signed-in email gets ADMIN_SUPER (demo)
 */
exports.ensureAdminAccess = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = request.auth.uid;
    const email = String(request.auth.token.email ?? '')
        .trim()
        .toLowerCase();
    const now = (0, time_1.nowIso)();
    const allowlist = parseAllowlist();
    // Demo-friendly: open self-provision unless explicitly disabled.
    // Lock down later with ALLOW_ADMIN_SELF_PROVISION=false + ADMIN_EMAIL_ALLOWLIST.
    const selfProvision = process.env.ALLOW_ADMIN_SELF_PROVISION !== 'false';
    const userRef = firebase_1.db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const existingRoles = userSnap.data()?.roleIds ?? [];
    if (hasAdminRole(existingRoles)) {
        await firebase_1.auth.setCustomUserClaims(uid, { roles: existingRoles });
        if (userSnap.data()?.accountState !== 'ACTIVE') {
            await userRef.set({ accountState: 'ACTIVE', updatedAt: now }, { merge: true });
        }
        (0, logger_1.logInfo)('admin_access_synced', { uid: uid.slice(0, 8) });
        return {
            ok: true,
            roles: existingRoles,
            provisioned: false,
            reason: 'existing_admin',
        };
    }
    let grant = false;
    let reason = '';
    if (email && allowlist.includes(email)) {
        grant = true;
        reason = 'allowlist';
    }
    else if (selfProvision) {
        grant = true;
        reason = 'self_provision';
    }
    else {
        const existingAdmin = await firebase_1.db
            .collection('users')
            .where('roleIds', 'array-contains', 'ADMIN_SUPER')
            .limit(1)
            .get();
        if (existingAdmin.empty) {
            grant = true;
            reason = 'first_admin';
        }
    }
    if (!grant) {
        (0, logger_1.logWarn)('admin_access_denied', {
            uid: uid.slice(0, 8),
            hasEmail: Boolean(email),
        });
        throw new https_1.HttpsError('permission-denied', 'This account is not authorized for the admin console. Ask an existing ADMIN_SUPER to grant access, or set ADMIN_EMAIL_ALLOWLIST / ALLOW_ADMIN_SELF_PROVISION on Functions.');
    }
    const roles = ['ADMIN_SUPER'];
    const marketIds = ['yyz'];
    await userRef.set({
        uid,
        email: email || null,
        phone: request.auth.token.phone_number ?? null,
        emailVerified: Boolean(request.auth.token.email_verified),
        phoneVerified: Boolean(request.auth.token.phone_number),
        roleIds: roles,
        marketIds,
        accountState: 'ACTIVE',
        consentVersions: userSnap.data()?.consentVersions ?? {},
        createdAt: userSnap.data()?.createdAt ?? now,
        updatedAt: now,
    }, { merge: true });
    await firebase_1.auth.setCustomUserClaims(uid, { roles });
    (0, logger_1.logInfo)('admin_access_granted', {
        uid: uid.slice(0, 8),
        reason,
    });
    return { ok: true, roles, provisioned: true, reason };
});
//# sourceMappingURL=ensureAdminAccess.js.map