"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
exports.requireMarketScope = requireMarketScope;
exports.assertAppCheck = assertAppCheck;
exports.withIdempotency = withIdempotency;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
function parseRoles(raw) {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((r) => contracts_1.RoleSchema.safeParse(r))
        .filter((r) => r.success)
        .map((r) => r.data);
}
/**
 * Verify Auth + cross-check users/{uid} role records (claims alone are insufficient
 * for frequently changing access).
 */
async function requireAuth(request) {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = request.auth.uid;
    const claimRoles = parseRoles(request.auth.token.roles);
    const userSnap = await firebase_1.db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
        // Allow first-time bootstrap for customer self-registration path only via dedicated fn
        throw new https_1.HttpsError('failed-precondition', 'User profile not provisioned');
    }
    const data = userSnap.data();
    if (data.accountState === 'DISABLED' || data.accountState === 'DEACTIVATED') {
        throw new https_1.HttpsError('permission-denied', 'Account disabled');
    }
    if (data.accountState === 'SUSPENDED') {
        throw new https_1.HttpsError('permission-denied', 'Account suspended');
    }
    const dbRoles = parseRoles(data.roleIds);
    // Intersection preference: only roles present in DB records
    const roles = dbRoles.length > 0
        ? dbRoles.filter((r) => claimRoles.includes(r) || dbRoles.includes(r))
        : claimRoles;
    // Prefer DB as source of truth when present
    const effectiveRoles = dbRoles.length > 0 ? dbRoles : roles;
    return {
        uid,
        roles: effectiveRoles,
        marketIds: Array.isArray(data.marketIds) ? data.marketIds : [],
        accountState: String(data.accountState ?? 'ACTIVE'),
        token: request.auth.token,
    };
}
function requirePermission(ctx, permission) {
    if (!(0, contracts_1.anyRoleHasPermission)(ctx.roles, permission)) {
        throw new https_1.HttpsError('permission-denied', `Missing permission ${permission}`);
    }
}
function requireMarketScope(ctx, marketId) {
    if (ctx.roles.includes('ADMIN_SUPER'))
        return;
    if (ctx.roles.some(contracts_1.isAdminRole)) {
        if (ctx.marketIds.length > 0 && !ctx.marketIds.includes(marketId)) {
            throw new https_1.HttpsError('permission-denied', 'Market out of scope');
        }
    }
}
function assertAppCheck(request) {
    const enforce = process.env.APPCHECK_ENFORCE === 'true';
    if (!enforce)
        return;
    if (!request.app) {
        throw new https_1.HttpsError('failed-precondition', 'App Check required');
    }
}
/** Idempotency: store result hash; replay returns stored response. */
async function withIdempotency(key, commandName, uid, execute) {
    const ref = firebase_1.db.collection('idempotency_keys').doc(`${commandName}_${key}`);
    const existing = await ref.get();
    if (existing.exists) {
        const data = existing.data();
        if (data.uid !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Idempotency key conflict');
        }
        return data.response;
    }
    const response = await execute();
    await ref.create({
        uid,
        commandName,
        response,
        createdAt: new Date().toISOString(),
    });
    return response;
}
//# sourceMappingURL=guards.js.map