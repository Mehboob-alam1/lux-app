'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AdminShell } from '@/components/AdminShell';
import { getDb, getFirebaseFunctions } from '@/lib/firebase';

type Booking = {
  bookingId: string;
  currentStatus: string;
  classId?: string;
  riskState?: string;
  customerPriceMinor?: number;
  currency?: string;
};

export default function AssignmentPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(getDb(), 'bookings'),
      where('currentStatus', 'in', ['ASSIGNMENT_PENDING', 'REASSIGNING']),
      limit(40),
    );
    return onSnapshot(
      q,
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as Booking;
            return { ...data, bookingId: data.bookingId ?? d.id };
          }),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, []);

  async function assign(bookingId: string) {
    setMsg('Assigning…');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'adminAssignBooking');
      await fn({
        idempotencyKey: `admin_assign_${bookingId}_${Date.now()}`,
        marketId: 'yyz',
        bookingId,
        driverId: prompt('Driver UID') || '',
        vehicleId: prompt('Vehicle ID', 'veh_demo_001') || 'veh_demo_001',
        reason: 'Manual rescue assignment',
        allowUpgradeComplimentary: false,
      });
      setMsg('Assigned');
    } catch (e) {
      setMsg(String(e));
    }
  }

  return (
    <AdminShell title="Assignment & Rescue">
      <p className="page-lede">
        Eligible independent drivers only. Customer price protected on platform
        upgrade. Fleet dispatch is next update.
      </p>
      {error ? <p className="warn-text">{error}</p> : null}
      {msg ? <p className="freshness">{msg}</p> : null}
      {rows.length === 0 ? (
        <p className="empty-state">No unassigned / reassigning bookings.</p>
      ) : (
        <div className="rescue-list">
          {rows.map((b) => (
            <article key={b.bookingId} className="panel rescue-card">
              <div className="rescue-meta">
                <strong>{b.bookingId}</strong>
                <span className="status-pill warn">{b.currentStatus}</span>
              </div>
              <p className="page-lede" style={{ marginBottom: 0 }}>
                {b.classId ?? '—'} · risk {b.riskState ?? 'NORMAL'}
                {b.customerPriceMinor != null
                  ? ` · ${(b.customerPriceMinor / 100).toFixed(2)} ${b.currency ?? ''}`
                  : ''}
              </p>
              <button type="button" className="chip active" onClick={() => assign(b.bookingId)}>
                Assign / rescue
              </button>
            </article>
          ))}
        </div>
      )}
      <style>{`
        .rescue-list { display: grid; gap: 0.75rem; }
        .rescue-card { display: grid; gap: 0.75rem; margin-bottom: 0; }
        .rescue-meta { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
        .rescue-card button { justify-self: start; border: 0; cursor: pointer; }
      `}</style>
    </AdminShell>
  );
}
