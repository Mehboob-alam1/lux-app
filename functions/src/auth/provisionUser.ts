import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { Role } from '@lux/contracts';
import { auth, db } from '../firebase';
import { assertAppCheck } from '../security/guards';
import { buildPendingDocumentRows } from '../admin/documentChecklist';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo, logWarn } from '../util/logger';

type ProvisionInput = {
  role: 'CUSTOMER' | 'DRIVER';
  displayName: string;
  marketIds?: string[];
  consentVersions?: Record<string, string>;
};

async function createPendingVehicleAndDocs(input: {
  uid: string;
  displayName: string;
  marketIds: string[];
  now: string;
}): Promise<{ vehicleId: string; driverStatus: string }> {
  const vehicleId = newId('veh');
  await db.collection('vehicles').doc(vehicleId).set({
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

  const docs = buildPendingDocumentRows({
    driverId: input.uid,
    vehicleId,
    now: input.now,
  });
  const batch = db.batch();
  for (const row of docs) {
    batch.set(db.collection('driver_documents').doc(row.id), row.data);
  }
  await batch.commit();

  await db.collection('drivers').doc(input.uid).set({
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

  await db.collection('driver_locations').doc(input.uid).set({
    driverId: input.uid,
    lat: 43.645,
    lng: -79.38,
    updatedAt: input.now,
    stale: false,
  });

  logWarn('driver_pending_review', { driverId: input.uid, vehicleId });
  return { vehicleId, driverStatus: 'PENDING' };
}

/**
 * First-time profile provisioning after Firebase Auth sign-in.
 * Drivers/vehicles/documents always start PENDING — ops must approve.
 */
export const provisionUser = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const uid = request.auth.uid;
    const data = request.data as ProvisionInput;
    if (data.role !== 'CUSTOMER' && data.role !== 'DRIVER') {
      throw new HttpsError('invalid-argument', 'Invalid role for self-provision');
    }

    const existing = await db.collection('users').doc(uid).get();
    if (existing.exists) {
      if (data.role === 'DRIVER') {
        const driver = await db.collection('drivers').doc(uid).get();
        if (!driver.exists) {
          const now = nowIso();
          const marketIds = data.marketIds?.length ? data.marketIds : ['yyz'];
          const repaired = await createPendingVehicleAndDocs({
            uid,
            displayName: data.displayName,
            marketIds,
            now,
          });
          await auth.setCustomUserClaims(uid, { roles: ['DRIVER'] });
          logInfo('driver_profile_repaired', {
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

    const now = nowIso();
    const roles: Role[] = [data.role];
    const marketIds = data.marketIds?.length ? data.marketIds : ['yyz'];

    await db.collection('users').doc(uid).set({
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
      await db.collection('customer_profiles').doc(uid).set({
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

    let driverStatus: string | null = null;
    let vehicleId: string | null = null;

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

    await auth.setCustomUserClaims(uid, { roles });
    logInfo('user_provisioned', {
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
  },
);

/** Emulator/dev only: seed admin claims. Disabled unless ALLOW_ADMIN_BOOTSTRAP=true */
export const bootstrapAdmin = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    if (process.env.ALLOW_ADMIN_BOOTSTRAP !== 'true') {
      res.status(403).send('Admin bootstrap disabled');
      return;
    }
    const { uid, roles, marketIds } = req.body as {
      uid: string;
      roles: Role[];
      marketIds?: string[];
    };
    if (!uid || !roles?.length) {
      res.status(400).send('uid and roles required');
      return;
    }
    const now = nowIso();
    await db.collection('users').doc(uid).set(
      {
        uid,
        roleIds: roles,
        marketIds: marketIds ?? ['yyz'],
        accountState: 'ACTIVE',
        consentVersions: {},
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    await auth.setCustomUserClaims(uid, { roles });
    logInfo('admin_bootstrapped', { uid });
    res.json({ ok: true, uid, roles });
  },
);
