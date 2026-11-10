'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { OpsMap, itineraryToPoints } from '@/components/OpsMap';
import { getDb } from '@/lib/firebase';
import { money, shortId, when } from '@/lib/format';

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [driverLoc, setDriverLoc] = useState<Record<string, unknown> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubB = onSnapshot(
      doc(getDb(), 'bookings', id),
      (snap) => {
        setBooking(
          snap.exists() ? (snap.data() as Record<string, unknown>) : null,
        );
      },
      (err) => setError(err.message),
    );
    const unsubE = onSnapshot(
      query(
        collection(getDb(), 'bookings', id, 'events'),
        orderBy('timestamp', 'asc'),
      ),
      (snap) =>
        setEvents(snap.docs.map((d) => d.data() as Record<string, unknown>)),
      () => undefined,
    );
    return () => {
      unsubB();
      unsubE();
    };
  }, [id]);

  const driverId = booking?.assignedDriverId as string | undefined;

  useEffect(() => {
    if (!driverId) {
      setDriverLoc(null);
      return;
    }
    return onSnapshot(
      doc(getDb(), 'driver_locations', driverId),
      (snap) => setDriverLoc(snap.exists() ? snap.data()! : null),
      () => undefined,
    );
  }, [driverId]);

  const mapPoints = useMemo(() => {
    const points = itineraryToPoints(booking?.itinerary);
    const lat = Number(driverLoc?.lat);
    const lng = Number(driverLoc?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      points.push({ lat, lng, label: 'Driver live' });
    }
    return points;
  }, [booking?.itinerary, driverLoc]);

  const needsRescue = ['ASSIGNMENT_PENDING', 'REASSIGNING'].includes(
    String(booking?.currentStatus ?? ''),
  );

  return (
    <AdminShell title={`Booking ${shortId(id, 14)}`}>
      <div className="chat-toolbar">
        <Link href="/bookings" className="btn-ghost">
          ← Bookings
        </Link>
        {needsRescue ? (
          <Link href="/assignment" className="btn-primary">
            Assign / rescue
          </Link>
        ) : null}
        {booking?.customerUid ? (
          <Link
            href={`/customers/${String(booking.customerUid)}`}
            className="btn-ghost"
          >
            Customer
          </Link>
        ) : null}
        {driverId ? (
          <Link href={`/drivers/${driverId}`} className="btn-ghost">
            Driver
          </Link>
        ) : null}
        <Link href="/support" className="btn-ghost">
          Support inbox
        </Link>
      </div>

      {error ? <p className="warn-text">{error}</p> : null}
      {!booking ? (
        <p className="empty-state">Booking not found or still loading.</p>
      ) : (
        <div className="detail-grid">
          <section className="panel">
            <div className="panel-head">
              <h2>Trip summary</h2>
              <span className="status-pill live">
                {String(booking.currentStatus)}
              </span>
            </div>
            <div className="detail-kv">
              <div>
                <span>Market</span>
                <strong>{String(booking.marketId ?? '—')}</strong>
              </div>
              <div>
                <span>Class</span>
                <strong>{String(booking.classId ?? '—')}</strong>
              </div>
              <div>
                <span>Customer fare</span>
                <strong>
                  {money(
                    booking.customerPriceMinor as number | undefined,
                    String(booking.currency ?? 'CAD'),
                  )}
                </strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>{String(booking.paymentStatus ?? '—')}</strong>
              </div>
              <div>
                <span>Risk</span>
                <strong>{String(booking.riskState ?? '—')}</strong>
              </div>
              <div>
                <span>Assignment</span>
                <strong>{shortId(String(booking.assignmentId ?? ''), 12)}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>{when(booking.updatedAt as string | undefined)}</strong>
              </div>
            </div>
          </section>

          <OpsMap points={mapPoints} title="Itinerary & driver" />

          <section className="panel">
            <div className="panel-head">
              <h2>Stops</h2>
            </div>
            {mapPoints.length === 0 ? (
              <p className="empty-state">No itinerary coordinates.</p>
            ) : (
              <ul className="ops-map-legend">
                {mapPoints.map((p, i) => (
                  <li key={`${p.lat}-${i}`}>
                    <span className="ops-map-pin">
                      {String.fromCharCode(65 + Math.min(i, 25))}
                    </span>
                    {p.label ?? `${p.lat}, ${p.lng}`}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Timeline</h2>
            </div>
            {events.length === 0 ? (
              <p className="empty-state">No events yet.</p>
            ) : (
              <ol className="timeline">
                {events.map((e, i) => (
                  <li key={i}>
                    <strong>{String(e.type)}</strong>
                    <span>
                      {String(e.previousStatus)} → {String(e.nextStatus)}
                    </span>
                    <small>{when(e.timestamp as string | undefined)}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
