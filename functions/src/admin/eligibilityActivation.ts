import { db } from '../firebase';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

/**
 * Activate driver only when vehicle is APPROVED and documents are eligible.
 */
export async function maybeActivateDriver(
  driverId: string,
): Promise<string | null> {
  const driverRef = db.collection('drivers').doc(driverId);
  const driverSnap = await driverRef.get();
  if (!driverSnap.exists) return null;
  const driver = driverSnap.data()!;
  const vehicleId = driver.currentVehicleId as string | undefined;
  if (!vehicleId) return driver.status ?? null;

  const vehicleSnap = await db.collection('vehicles').doc(vehicleId).get();
  if (!vehicleSnap.exists) return driver.status ?? null;
  const vehicle = vehicleSnap.data()!;

  const ready =
    vehicle.status === 'APPROVED' && vehicle.documentEligibilityOk === true;

  const now = nowIso();
  if (ready) {
    await driverRef.set(
      {
        status: 'ACTIVE',
        statusReason: 'Vehicle and documents approved by ops',
        updatedAt: now,
      },
      { merge: true },
    );
    await db.collection('users').doc(driverId).set(
      {
        accountState: 'ACTIVE',
        updatedAt: now,
      },
      { merge: true },
    );
    logInfo('driver_activated', { driverId: driverId.slice(0, 8) });
    return 'ACTIVE';
  }

  if (driver.status === 'ACTIVE') {
    await driverRef.set(
      {
        status: 'PENDING',
        statusReason: 'Awaiting vehicle/document approval',
        onlineState: 'OFFLINE',
        updatedAt: now,
      },
      { merge: true },
    );
    return 'PENDING';
  }

  return driver.status ?? 'PENDING';
}
