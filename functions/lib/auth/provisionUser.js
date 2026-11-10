"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrapAdmin = exports.provisionUser = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const documentChecklist_1 = require("../admin/documentChecklist");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
async function createPendingVehicleAndDocs(input) {
    const vehicleId = (0, ids_1.newId)('veh');
    await firebase_1.db.collection('vehicles').doc(vehicleId).set({
        vehicleId,
        ownerDriverId: input.uid,
        classIds: ['COMFORT', 'EXECUTIVE'],
        capacityPassengers: 3,
        capacityLuggage: 2,
        make: 'Mercedes-Benz',
        model: 'E-Class',
        year: 2023,
        plate: `LUX-${input.uid.slice(-4).toUpperCase()}`,
        color: 'Black',
        photoPaths: [],
        status: 'PENDING',
        inspectionStatus: 'PENDING',
        documentEligibilityOk: false,
        reviewChecklist: {
            plateVerified: false,
            classConfirmed: false,
            photosReviewed: false,
            inspectionPassed: false,
        },
        createdAt: input.now,
        updatedAt: input.now,
    });
    const docs = (0, documentChecklist_1.buildPendingDocumentRows)({
        driverId: input.uid,
        vehicleId,
        now: input.now,
    });
    const batch = firebase_1.db.batch();
    for (const row of docs) {
        batch.set(firebase_1.db.collection('driver_documents').doc(row.id), row.data);
    }
    await batch.commit();
    await firebase_1.db.collection('drivers').doc(input.uid).set({
        uid: input.uid,
        status: 'PENDING',
        driverType: 'OWNER_DRIVER',
        displayName: input.displayName,
        capabilities: ['AIRPORT'],
        marketIds: input.marketIds,
        currentVehicleId: vehicleId,
        onlineState: 'OFFLINE',
        readiness: {},
        payoutAccountReference: null,
        performance: { completionRate: 0.9, onTimeRate: 0.9 },
        statusReason: 'Complete vehicle & documents checklist — await ops approval',
        createdAt: input.now,
        updatedAt: input.now,
    });
    await firebase_1.db.collection('driver_locations').doc(input.uid).set({
        driverId: input.uid,
        lat: 43.645,
        lng: -79.38,
        updatedAt: input.now,
        stale: false,
    });
    (0, logger_1.logWarn)('driver_pending_review', { driverId: input.uid, vehicleId });
    return { vehicleId, driverStatus: 'PENDING' };
}
/**
 * First-time profile provisioning after Firebase Auth sign-in.
 * Drivers/vehicles/documents always start PENDING — ops must approve.
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
        if (data.role === 'DRIVER') {
            const driver = await firebase_1.db.collection('drivers').doc(uid).get();
            if (!driver.exists) {
                const now = (0, time_1.nowIso)();
                const marketIds = data.marketIds?.length ? data.marketIds : ['yyz'];
                const repaired = await createPendingVehicleAndDocs({
                    uid,
                    displayName: data.displayName,
                    marketIds,
                    now,
                });
                await firebase_1.auth.setCustomUserClaims(uid, { roles: ['DRIVER'] });
                (0, logger_1.logInfo)('driver_profile_repaired', {
                    driverStatus: repaired.driverStatus,
                });
                return {
                    uid,
                    alreadyProvisioned: true,
                    repaired: true,
                    driverStatus: repaired.driverStatus,
                    vehicleId: repaired.vehicleId,
                };
            }
            return {
                uid,
                alreadyProvisioned: true,
                driverStatus: driver.data()?.status ?? null,
            };
        }
        return {
            uid,
            alreadyProvisioned: true,
            driverStatus: null,
        };
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
    let driverStatus = null;
    let vehicleId = null;
    if (data.role === 'DRIVER') {
        const created = await createPendingVehicleAndDocs({
            uid,
            displayName: data.displayName,
            marketIds,
            now,
        });
        driverStatus = created.driverStatus;
        vehicleId = created.vehicleId;
    }
    await firebase_1.auth.setCustomUserClaims(uid, { roles });
    (0, logger_1.logInfo)('user_provisioned', {
        role: data.role,
        driverStatus: driverStatus ?? undefined,
    });
    return {
        uid,
        roles,
        alreadyProvisioned: false,
        driverStatus,
        vehicleId,
    };
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
    (0, logger_1.logInfo)('admin_bootstrapped', { uid });
    res.json({ ok: true, uid, roles });
});
//# sourceMappingURL=provisionUser.js.map