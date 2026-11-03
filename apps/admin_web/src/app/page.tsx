'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  collection,
  getCountFromServer,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';

export default function DashboardPage() {
  const [active, setActive] = useState<number | null>(null);
  const [unassigned, setUnassigned] = useState<number | null>(null);
  const [driversOnline, setDriversOnline] = useState<number | null>(null);
  const [supportOpen, setSupportOpen] = useState<number | null>(null);
  const [recent, setRecent] = useState<
    { id: string; status: string; updatedAt?: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    let cancelled = false;

    async function loadCounts() {
      try {
        const [a, u, d, s] = await Promise.all([
          getCountFromServer(
            query(
              collection(db, 'bookings'),
              where('currentStatus', 'in', [
                'ASSIGNED',
                'DRIVER_EN_ROUTE',
                'DRIVER_ARRIVED',
                'WAITING',
                'PASSENGER_ONBOARD',
                'IN_PROGRESS',
                'REASSIGNING',
                'ASSIGNMENT_PENDING',
              ]),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, 'bookings'),
              where('currentStatus', 'in', [
                'ASSIGNMENT_PENDING',
                'REASSIGNING',
              ]),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, 'drivers'),
              where('onlineState', '==', 'ONLINE'),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, 'support_cases'),
              where('status', '==', 'OPEN'),
            ),
          ),
        ]);
        if (cancelled) return;
        setActive(a.data().count);
        setUnassigned(u.data().count);
        setDriversOnline(d.data().count);
        setSupportOpen(s.data().count);
        setFreshAt(new Date().toISOString());
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(
            `Live counts unavailable (${String(e)}). Sign in as admin@lux.test with emulators running.`,
          );
        }
      }
    }

    loadCounts();
    const unsub = onSnapshot(
      query(collection(db, 'bookings'), orderBy('updatedAt', 'desc'), limit(8)),
      (snap) => {
        setRecent(
          snap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: (data.bookingId as string) ?? doc.id,
              status: (data.currentStatus as string) ?? '—',
              updatedAt: data.updatedAt as string | undefined,
            };
          }),
        );
        setFreshAt(new Date().toISOString());
      },
      (err) => setError(err.message),
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const kpis = [
    { label: 'Active bookings', value: active, href: '/bookings?status=active' },
    {
      label: 'Unassigned',
      value: unassigned,
      href: '/assignment?filter=unassigned',
    },
    { label: 'Drivers online', value: driversOnline, href: '/drivers' },
    { label: 'Open support', value: supportOpen, href: '/support' },
  ];

  return (
    <AdminShell>
      <div className="hero-brand">
        <div className="logo">L</div>
        <h1>LUX</h1>
        <p className="lede">
          Live Firebase command center. Counts and bookings stream from the
          emulator / project — never fabricated.
        </p>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Operations health</h2>
          <p
            className={`freshness${freshAt ? '' : ' warn'}`}
            role="status"
          >
            {freshAt
              ? `Fresh at ${freshAt}`
              : 'Waiting for Firestore listeners…'}
          </p>
        </div>
        {error ? <p className="warn-text">{error}</p> : null}
      </section>

      <section className="kpi-grid">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="kpi">
            <span className="kpi-label">{k.label}</span>
            <span className="kpi-value">
              {k.value === null ? '—' : k.value}
            </span>
            <span className="kpi-note">Live Firestore</span>
          </Link>
        ))}
      </section>

      <section className="panel lime">
        <h2>Recent bookings</h2>
        {recent.length === 0 ? (
          <p className="empty-state">
            No bookings yet — create one from the customer app.
          </p>
        ) : (
          <ul className="recent">
            {recent.map((r) => (
              <li key={r.id}>
                <Link href={`/bookings/${r.id}`}>
                  <strong>{r.id}</strong>
                  <span className="status-pill live">{r.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}
