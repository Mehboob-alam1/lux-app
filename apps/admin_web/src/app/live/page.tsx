'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';

export default function LiveOpsPage() {
  const [active, setActive] = useState(0);
  const [alerts, setAlerts] = useState<
    { type?: string; health?: string; bookingId?: string }[]
  >([]);
  const [freshAt, setFreshAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubA = onSnapshot(
      query(
        collection(getDb(), 'bookings'),
        where('currentStatus', 'in', [
          'ASSIGNED',
          'DRIVER_EN_ROUTE',
          'DRIVER_ARRIVED',
          'WAITING',
          'PASSENGER_ONBOARD',
          'IN_PROGRESS',
          'REASSIGNING',
        ]),
        limit(100),
      ),
      (snap) => {
        setActive(snap.size);
        setFreshAt(new Date().toISOString());
        setError(null);
      },
      (err) => {
        setError(err.message);
        setFreshAt(null);
      },
    );
    const unsubB = onSnapshot(
      query(
        collection(getDb(), 'operational_alerts'),
        orderBy('createdAt', 'desc'),
        limit(20),
      ),
      (snap) => setAlerts(snap.docs.map((d) => d.data() as (typeof alerts)[0])),
      () => undefined,
    );
    return () => {
      unsubA();
      unsubB();
    };
  }, []);

  return (
    <AdminShell title="Live Operations">
      <p className="page-lede">
        Real-time trip pulse and operational alerts from Firestore listeners.
      </p>
      <p className={`freshness${freshAt ? '' : ' warn'}`} role="status">
        {freshAt
          ? `Listeners fresh at ${freshAt}`
          : 'Data freshness warning: disconnected'}
      </p>
      {error ? <p className="warn-text">{error}</p> : null}

      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <div className="kpi">
          <span className="kpi-label">Active trips</span>
          <span className="kpi-value">{active}</span>
          <span className="kpi-note">Live booking stream</span>
        </div>
      </section>

      <section className="panel">
        <h2>Needs attention</h2>
        {alerts.length === 0 ? (
          <p className="empty-state">No operational alerts.</p>
        ) : (
          <ul className="recent">
            {alerts.map((a, i) => (
              <li key={i}>
                <span>
                  <strong>{a.health ?? 'ALERT'}</strong> · {a.type} ·{' '}
                  {a.bookingId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
