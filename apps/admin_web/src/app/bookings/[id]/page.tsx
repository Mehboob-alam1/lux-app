'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubB = onSnapshot(
      doc(getDb(), 'bookings', id),
      (snap) => {
        setBooking(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
      },
      (err) => setError(err.message),
    );
    const unsubE = onSnapshot(
      query(
        collection(getDb(), 'bookings', id, 'events'),
        orderBy('timestamp', 'asc'),
      ),
      (snap) => setEvents(snap.docs.map((d) => d.data() as Record<string, unknown>)),
      () => undefined,
    );
    return () => {
      unsubB();
      unsubE();
    };
  }, [id]);

  return (
    <AdminShell title={`Booking ${id}`}>
      {error ? <p style={{ color: 'var(--lux-warn)' }}>{error}</p> : null}
      {!booking ? (
        <p style={{ color: 'var(--lux-muted)' }}>Booking not found or not loaded.</p>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <section
            style={{
              border: '1px solid var(--lux-line)',
              borderRadius: 10,
              padding: 16,
            }}
          >
            <div>
              Status: <strong>{String(booking.currentStatus)}</strong> · Market:{' '}
              {String(booking.marketId)} · Risk: {String(booking.riskState)}
            </div>
            <div>
              Customer fare: {String(booking.customerPriceMinor)}{' '}
              {String(booking.currency)} (payment {String(booking.paymentStatus)})
            </div>
            <div>
              Driver payout: {String(booking.driverPayoutMinor)} — stored separately
            </div>
            <div>
              Assignment: {String(booking.assignmentId ?? 'none')} · Driver:{' '}
              {String(booking.assignedDriverId ?? 'none')}
            </div>
          </section>
          <section>
            <h2 style={{ fontSize: '1rem' }}>Append-only timeline</h2>
            {events.length === 0 ? (
              <p style={{ color: 'var(--lux-muted)' }}>No events yet.</p>
            ) : (
              <ol>
                {events.map((e, i) => (
                  <li key={i}>
                    {String(e.timestamp)} — {String(e.type)} (
                    {String(e.previousStatus)} → {String(e.nextStatus)})
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
