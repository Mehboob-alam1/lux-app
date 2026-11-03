import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db } from '../firebase';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

/** Expire open quotes past expiresAt. */
export const expireQuotesJob = onSchedule('every 5 minutes', async () => {
  const now = nowIso();
  const snap = await db
    .collection('quotes')
    .where('redemptionState', '==', 'OPEN')
    .where('expiresAt', '<=', now)
    .limit(200)
    .get();
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { redemptionState: 'EXPIRED' }));
  await batch.commit();
  logInfo('job_expire_quotes', { count: snap.size });
});

/** Mark stale driver locations. */
export const staleLocationsJob = onSchedule('every 5 minutes', async () => {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  const snap = await db
    .collection('driver_locations')
    .where('updatedAt', '<', cutoff)
    .limit(200)
    .get();
  const batch = db.batch();
  snap.docs.forEach((d) =>
    batch.update(d.ref, { stale: true, staleSince: nowIso() }),
  );
  await batch.commit();
  logInfo('job_stale_locations', { count: snap.size });
});

/** Age unassigned bookings into AT_RISK / RESCUE alerts. */
export const unassignedAgingJob = onSchedule('every 5 minutes', async () => {
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const snap = await db
    .collection('bookings')
    .where('currentStatus', 'in', ['ASSIGNMENT_PENDING', 'REASSIGNING'])
    .where('updatedAt', '<', cutoff)
    .limit(100)
    .get();
  const batch = db.batch();
  const now = nowIso();
  for (const d of snap.docs) {
    batch.update(d.ref, { riskState: 'AT_RISK', updatedAt: now });
  }
  await batch.commit();
  logInfo('job_unassigned_aging', { count: snap.size });
});

/** Document expiry → flip eligibility (simplified). */
export const documentExpiryJob = onSchedule('every 60 minutes', async () => {
  const now = nowIso();
  const snap = await db
    .collection('vehicle_documents')
    .where('reviewState', '==', 'APPROVED')
    .where('expiryAt', '<=', now)
    .limit(100)
    .get();
  const batch = db.batch();
  for (const d of snap.docs) {
    batch.update(d.ref, { reviewState: 'EXPIRED' });
    const vehicleId = d.data().vehicleId;
    if (vehicleId) {
      batch.update(db.collection('vehicles').doc(vehicleId), {
        documentEligibilityOk: false,
        updatedAt: now,
      });
    }
  }
  await batch.commit();
  logInfo('job_document_expiry', { count: snap.size });
});
