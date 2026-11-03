import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

/**
 * Online eligibility gate — driver cannot go online unless ACTIVE,
 * approved eligible vehicle, and documents OK.
 */
export const setDriverOnline = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    if (!ctx.roles.includes('DRIVER') && !ctx.roles.includes('ADMIN_SUPER')) {
      throw new HttpsError('permission-denied', 'Driver role required');
    }
    const { online } = request.data as { online: boolean };
    const driverRef = db.collection('drivers').doc(ctx.uid);
    const snap = await driverRef.get();
    if (!snap.exists) throw new HttpsError('not-found', 'Driver profile missing');
    const driver = snap.data()!;

    if (!online) {
      await driverRef.update({
        onlineState: 'OFFLINE',
        updatedAt: nowIso(),
      });
      return { onlineState: 'OFFLINE', ok: true };
    }

    const reasons: string[] = [];
    if (driver.status !== 'ACTIVE') {
      reasons.push(
        driver.statusReason ||
          `Account status is ${driver.status} — not eligible to go online`,
      );
    }
    if (!driver.currentVehicleId) {
      reasons.push('No current vehicle assigned');
    } else {
      const v = await db.collection('vehicles').doc(driver.currentVehicleId).get();
      if (!v.exists || v.data()?.status !== 'APPROVED') {
        reasons.push('Vehicle is not approved');
      }
      if (!v.data()?.documentEligibilityOk) {
        reasons.push('Vehicle documents are not eligible / expired');
      }
    }

    if (reasons.length) {
      throw new HttpsError('failed-precondition', reasons.join('; '), {
        reasons,
      });
    }

    await driverRef.update({
      onlineState: 'ONLINE',
      updatedAt: nowIso(),
    });
    logInfo('driver_online', { driverId: ctx.uid });
    return { onlineState: 'ONLINE', ok: true };
  },
);
