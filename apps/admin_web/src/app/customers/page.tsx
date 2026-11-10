'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';
import { shortId, when } from '@/lib/format';

type Customer = {
  uid: string;
  displayName?: string;
  updatedAt?: string;
  notificationSettings?: Record<string, boolean>;
};

export default function CustomersPage() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(
        collection(getDb(), 'customer_profiles'),
        orderBy('updatedAt', 'desc'),
        limit(80),
      ),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as Customer;
            return { ...data, uid: data.uid ?? d.id };
          }),
        );
        setFreshAt(new Date().toISOString());
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, []);

  return (
    <AdminShell title="Customers">
      <div className="doc-hero">
        <div>
          <p className="eyebrow">Riders</p>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            Open a customer to see bookings and support threads.
          </p>
        </div>
        <div className="doc-stat">
          <strong>{rows.length}</strong>
          <span>Profiles</span>
        </div>
      </div>
      <p className={`freshness${freshAt ? '' : ' warn'}`} role="status">
        {freshAt
          ? `Fresh at ${new Date(freshAt).toLocaleTimeString()}`
          : 'Connecting…'}
      </p>
      {error ? <p className="warn-text">{error}</p> : null}

      {rows.length === 0 ? (
        <div className="empty-visual">
          <div className="empty-visual-mark" aria-hidden />
          <h2>No customers yet</h2>
          <p>Signups from the customer app appear here automatically.</p>
        </div>
      ) : (
        <div className="people-grid">
          {rows.map((c) => {
            const n = c.notificationSettings;
            return (
              <Link
                key={c.uid}
                href={`/customers/${c.uid}`}
                className="people-card"
              >
                <div className="detail-avatar sm" aria-hidden>
                  {String(c.displayName ?? 'C')
                    .slice(0, 1)
                    .toUpperCase()}
                </div>
                <div>
                  <strong>{c.displayName ?? shortId(c.uid, 12)}</strong>
                  <small>{shortId(c.uid, 14)}</small>
                  <small>
                    {[
                      n?.push ? 'push' : null,
                      n?.email ? 'email' : null,
                      n?.sms ? 'sms' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'notifications off'}
                    {' · '}
                    {when(c.updatedAt)}
                  </small>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
