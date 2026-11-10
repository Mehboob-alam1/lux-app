'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';
import { money, shortId, when } from '@/lib/format';

export default function CustomerDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [userDoc, setUserDoc] = useState<Record<string, unknown> | null>(null);
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [cases, setCases] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(
      doc(getDb(), 'customer_profiles', uid),
      (snap) => setProfile(snap.exists() ? snap.data()! : null),
      (err) => setError(err.message),
    );
    const u2 = onSnapshot(
      doc(getDb(), 'users', uid),
      (snap) => setUserDoc(snap.exists() ? snap.data()! : null),
      () => undefined,
    );
    const u3 = onSnapshot(
      query(
        collection(getDb(), 'bookings'),
        where('customerUid', '==', uid),
        orderBy('updatedAt', 'desc'),
        limit(30),
      ),
      (snap) =>
        setBookings(
          snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        ),
      () => {
        // Fallback without composite index: still show page
      },
    );
    const u4 = onSnapshot(
      query(
        collection(getDb(), 'support_cases'),
        where('ownerUid', '==', uid),
        orderBy('updatedAt', 'desc'),
        limit(20),
      ),
      (snap) =>
        setCases(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => undefined,
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, [uid]);

  return (
    <AdminShell title="Customer">
      <div className="chat-toolbar">
        <Link href="/customers" className="btn-ghost">
          ← Customers
        </Link>
      </div>
      {error ? <p className="warn-text">{error}</p> : null}

      <section className="detail-hero panel">
        <div className="detail-avatar" aria-hidden>
          {String(profile?.displayName ?? 'C')
            .slice(0, 1)
            .toUpperCase()}
        </div>
        <div>
          <p className="eyebrow">Customer profile</p>
          <h2>{String(profile?.displayName ?? shortId(uid, 12))}</h2>
          <p className="doc-meta">
            {String(userDoc?.email ?? 'No email on file')} · account{' '}
            {String(userDoc?.accountState ?? '—')} · uid {uid}
          </p>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Bookings</h2>
          </div>
          {bookings.length === 0 ? (
            <p className="empty-state">No bookings for this customer.</p>
          ) : (
            <ul className="recent">
              {bookings.map((b) => (
                <li key={String(b.id)}>
                  <Link href={`/bookings/${String(b.bookingId ?? b.id)}`}>
                    <strong>{shortId(String(b.bookingId ?? b.id), 14)}</strong>
                    <span className="status-pill live">
                      {String(b.currentStatus)}
                    </span>
                  </Link>
                  <small className="detail-sub">
                    {money(
                      b.customerPriceMinor as number | undefined,
                      String(b.currency ?? 'CAD'),
                    )}{' '}
                    · {when(b.updatedAt as string | undefined)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Support cases</h2>
          </div>
          {cases.length === 0 ? (
            <p className="empty-state">No support cases.</p>
          ) : (
            <ul className="recent">
              {cases.map((c) => (
                <li key={String(c.id)}>
                  <Link href={`/support/${String(c.caseId ?? c.id)}`}>
                    <strong>{String(c.subject ?? c.caseId)}</strong>
                    <span className="status-pill warn">
                      {String(c.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
