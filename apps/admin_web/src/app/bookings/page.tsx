'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';
import { money, shortId, when } from '@/lib/format';

type BookingRow = {
  bookingId: string;
  currentStatus: string;
  marketId?: string;
  classId?: string;
  riskState?: string;
  customerUid?: string;
  assignedDriverId?: string | null;
  customerPriceMinor?: number;
  currency?: string;
  updatedAt?: string;
  itinerary?: unknown;
};

function statusClass(status: string) {
  if (
    ['PAYMENT_CAPTURED', 'COMPLETED', 'ASSIGNED', 'IN_PROGRESS'].includes(
      status,
    )
  ) {
    return 'ok';
  }
  if (
    ['REASSIGNING', 'ASSIGNMENT_PENDING', 'WAITING', 'DRIVER_EN_ROUTE'].includes(
      status,
    )
  ) {
    return 'warn';
  }
  if (status.includes('CANCEL') || status.includes('NO_SHOW')) return 'danger';
  return 'live';
}

function stopLabel(itinerary: unknown, index: number) {
  if (!Array.isArray(itinerary) || !itinerary[index]) return null;
  const stop = itinerary[index] as {
    place?: { label?: string; formattedAddress?: string };
    label?: string;
  };
  return (
    stop.place?.label ||
    stop.place?.formattedAddress ||
    stop.label ||
    null
  );
}

export default function BookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const q = query(
      collection(getDb(), 'bookings'),
      orderBy('updatedAt', 'desc'),
      limit(80),
    );
    return onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as BookingRow;
            return { ...data, bookingId: data.bookingId ?? d.id };
          }),
        );
        setFreshAt(new Date().toISOString());
        setError(null);
      },
      (err) => {
        setError(err.message);
        setFreshAt(null);
      },
    );
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return rows;
    if (statusFilter === 'active') {
      return rows.filter((r) =>
        [
          'ASSIGNED',
          'DRIVER_EN_ROUTE',
          'DRIVER_ARRIVED',
          'WAITING',
          'PASSENGER_ONBOARD',
          'IN_PROGRESS',
          'REASSIGNING',
          'ASSIGNMENT_PENDING',
        ].includes(r.currentStatus),
      );
    }
    if (statusFilter === 'unassigned') {
      return rows.filter((r) =>
        ['ASSIGNMENT_PENDING', 'REASSIGNING'].includes(r.currentStatus),
      );
    }
    return rows.filter((r) => r.currentStatus === statusFilter);
  }, [rows, statusFilter]);

  return (
    <AdminShell title="Bookings">
      <div className="doc-hero">
        <div>
          <p className="eyebrow">Trip ledger</p>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            Live bookings from Firestore — open any card for map, timeline, and
            rescue links.
          </p>
        </div>
        <div className="doc-stat">
          <strong>{filtered.length}</strong>
          <span>Showing</span>
        </div>
      </div>

      <p className={`freshness${freshAt ? '' : ' warn'}`} role="status">
        {freshAt
          ? `Fresh at ${new Date(freshAt).toLocaleTimeString()}`
          : 'Connecting…'}
      </p>
      {error ? <p className="warn-text">{error}</p> : null}

      <div className="chip-row">
        {['all', 'active', 'unassigned', 'COMPLETED', 'REASSIGNING'].map(
          (f) => (
            <button
              key={f}
              type="button"
              className={`chip${statusFilter === f ? ' active' : ''}`}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </button>
          ),
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-visual">
          <div className="empty-visual-mark" aria-hidden />
          <h2>No bookings in this filter</h2>
          <p>Create a trip from the customer app — it will stream in live.</p>
        </div>
      ) : (
        <div className="booking-card-grid">
          {filtered.map((b) => {
            const pickup = stopLabel(b.itinerary, 0);
            const drop = stopLabel(b.itinerary, 1);
            const needsRescue = ['ASSIGNMENT_PENDING', 'REASSIGNING'].includes(
              b.currentStatus,
            );
            return (
              <article key={b.bookingId} className="booking-card">
                <div className="booking-card-top">
                  <Link href={`/bookings/${b.bookingId}`}>
                    <strong>{shortId(b.bookingId, 14)}</strong>
                  </Link>
                  <span className={`status-pill ${statusClass(b.currentStatus)}`}>
                    {b.currentStatus}
                  </span>
                </div>
                <div className="booking-route">
                  <div>
                    <span>Pickup</span>
                    <strong>{pickup ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Dropoff</span>
                    <strong>{drop ?? '—'}</strong>
                  </div>
                </div>
                <div className="booking-card-meta">
                  <span>{b.classId ?? '—'}</span>
                  <span>
                    {money(b.customerPriceMinor, b.currency ?? 'CAD')}
                  </span>
                  <span>{when(b.updatedAt)}</span>
                </div>
                <div className="booking-card-actions">
                  {b.customerUid ? (
                    <Link
                      href={`/customers/${b.customerUid}`}
                      className="btn-ghost"
                    >
                      Customer
                    </Link>
                  ) : null}
                  {b.assignedDriverId ? (
                    <Link
                      href={`/drivers/${b.assignedDriverId}`}
                      className="btn-ghost"
                    >
                      Driver
                    </Link>
                  ) : null}
                  {needsRescue ? (
                    <Link href="/assignment" className="btn-primary">
                      Rescue
                    </Link>
                  ) : (
                    <Link
                      href={`/bookings/${b.bookingId}`}
                      className="btn-primary"
                    >
                      Open
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
