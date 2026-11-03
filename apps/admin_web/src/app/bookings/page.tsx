'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';

type BookingRow = {
  bookingId: string;
  currentStatus: string;
  marketId: string;
  riskState?: string;
  customerPriceMinor?: number;
  currency?: string;
  updatedAt?: string;
};

function statusClass(status: string) {
  if (['PAYMENT_CAPTURED', 'COMPLETED', 'ASSIGNED', 'IN_PROGRESS'].includes(status)) {
    return 'ok';
  }
  if (['REASSIGNING', 'ASSIGNMENT_PENDING', 'WAITING'].includes(status)) {
    return 'warn';
  }
  if (status.includes('CANCEL') || status.includes('NO_SHOW')) return 'danger';
  return 'live';
}

export default function BookingsPage() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    try {
      const q = query(
        collection(getDb(), 'bookings'),
        orderBy('updatedAt', 'desc'),
        limit(50),
      );
      const unsub = onSnapshot(
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
          setError(
            `Live bookings unavailable (${err.message}). Start emulators with NEXT_PUBLIC_USE_EMULATORS=true — no fabricated rows.`,
          );
          setFreshAt(null);
        },
      );
      return () => unsub();
    } catch (e) {
      setError(String(e));
      return undefined;
    }
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
      <p className="page-lede">
        Authoritative list from Firestore. KPI deep-links use query filters —
        empty means empty, not mock data.
      </p>
      <p className={`freshness${freshAt ? '' : ' warn'}`} role="status">
        {freshAt
          ? `Data fresh at ${freshAt}`
          : 'Data freshness warning: listener not connected'}
      </p>
      {error ? <p className="warn-text">{error}</p> : null}

      <div className="chip-row">
        {['all', 'active', 'unassigned', 'COMPLETED', 'REASSIGNING'].map((f) => (
          <button
            key={f}
            type="button"
            className={`chip${statusFilter === f ? ' active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No bookings match this filter.</p>
      ) : (
        <div className="table-shell">
          <table className="lux-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Market</th>
                <th>Risk</th>
                <th>Customer fare</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.bookingId}>
                  <td>
                    <Link href={`/bookings/${b.bookingId}`}>{b.bookingId}</Link>
                  </td>
                  <td>
                    <span className={`status-pill ${statusClass(b.currentStatus)}`}>
                      {b.currentStatus}
                    </span>
                  </td>
                  <td>{b.marketId}</td>
                  <td>{b.riskState ?? '—'}</td>
                  <td>
                    {b.customerPriceMinor != null
                      ? `${(b.customerPriceMinor / 100).toFixed(2)} ${b.currency ?? ''}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
