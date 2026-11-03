import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { createHash, randomBytes } from 'crypto';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { addMinutesIso, isExpired, nowIso } from '../util/time';
import { newId } from '../util/ids';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Create expiring guest journey link — returns raw token once. */
export const createGuestLink = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const { bookingId, ttlMinutes } = request.data as {
      bookingId: string;
      ttlMinutes?: number;
    };
    const booking = await db.collection('bookings').doc(bookingId).get();
    if (!booking.exists) throw new HttpsError('not-found', 'Booking not found');
    const b = booking.data()!;
    if (b.customerUid !== ctx.uid && b.bookerUid !== ctx.uid) {
      if (!ctx.roles.some((r) => r.startsWith('ADMIN_'))) {
        throw new HttpsError('permission-denied', 'Not your booking');
      }
    }
    const raw = randomBytes(32).toString('base64url');
    const linkId = newId('gst');
    await db.collection('guest_links').doc(linkId).set({
      linkId,
      bookingId,
      tokenHash: hashToken(raw),
      permissions: [
        'view_chauffeur',
        'view_vehicle',
        'view_plate',
        'view_meeting_point',
        'view_eta',
        'update_readiness',
        'contact',
      ],
      expiresAt: addMinutesIso(ttlMinutes ?? 60 * 24),
      createdAt: nowIso(),
      createdBy: ctx.uid,
    });
    return {
      linkId,
      token: raw,
      // Client builds URL; never store raw token
      path: `/guest/${linkId}?t=${raw}`,
    };
  },
);

/**
 * Public HTTPS guest view — scoped fields only (no prices / private PII).
 */
export const resolveGuestLink = onRequest(
  { region: 'us-central1', cors: true },
  async (req, res) => {
    const linkId = String(req.query.linkId || req.body?.linkId || '');
    const token = String(req.query.t || req.body?.t || '');
    if (!linkId || !token) {
      res.status(400).json({ error: 'linkId and t required' });
      return;
    }
    const linkSnap = await db.collection('guest_links').doc(linkId).get();
    if (!linkSnap.exists) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const link = linkSnap.data()!;
    if (link.tokenHash !== hashToken(token)) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }
    if (isExpired(link.expiresAt)) {
      res.status(410).json({ error: 'Link expired' });
      return;
    }
    const bookingSnap = await db.collection('bookings').doc(link.bookingId).get();
    if (!bookingSnap.exists) {
      res.status(404).json({ error: 'Booking missing' });
      return;
    }
    const b = bookingSnap.data()!;
    let chauffeur: Record<string, unknown> | null = null;
    let vehicle: Record<string, unknown> | null = null;
    if (b.assignedDriverId) {
      const d = await db.collection('drivers').doc(b.assignedDriverId).get();
      chauffeur = {
        displayName: d.data()?.displayName ?? null,
        // no phone dump — contact via mediated action later
      };
    }
    if (b.assignedVehicleId) {
      const v = await db.collection('vehicles').doc(b.assignedVehicleId).get();
      vehicle = {
        make: v.data()?.make,
        model: v.data()?.model,
        color: v.data()?.color,
        plate: v.data()?.plate,
        // class ok; no VIN
        classIds: v.data()?.classIds,
      };
    }
    const pickup = b.itinerary?.find(
      (s: { kind: string }) => s.kind === 'PICKUP',
    );

    // Explicitly omit customerPriceMinor, payment, personal phone/email
    res.json({
      bookingId: b.bookingId,
      currentStatus: b.currentStatus,
      scheduledAt: b.scheduledAt,
      meetingPoint: pickup?.place?.label ?? null,
      meetingAddress: pickup?.place?.address ?? null,
      readiness: b.airport?.readiness ?? null,
      chauffeur,
      vehicle,
      permissions: link.permissions,
      expiresAt: link.expiresAt,
    });
  },
);
