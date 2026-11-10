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

type SupportCase = {
  caseId: string;
  subject?: string;
  priority?: string;
  status?: string;
  category?: string;
  ownerUid?: string;
  bookingId?: string | null;
  lastMessagePreview?: string;
  updatedAt?: string;
};

type Incident = {
  incidentId?: string;
  subject?: string;
  priority?: string;
  status?: string;
};

export default function SupportPage() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(
      query(
        collection(getDb(), 'support_cases'),
        orderBy('updatedAt', 'desc'),
        limit(60),
      ),
      (s) => {
        setCases(
          s.docs.map((d) => {
            const data = d.data() as SupportCase;
            return { ...data, caseId: data.caseId ?? d.id };
          }),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );
    const u2 = onSnapshot(
      query(
        collection(getDb(), 'incidents'),
        orderBy('updatedAt', 'desc'),
        limit(20),
      ),
      (s) => setIncidents(s.docs.map((d) => d.data() as Incident)),
      () => undefined,
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  return (
    <AdminShell title="Help & Support">
      <div className="doc-hero">
        <div>
          <p className="eyebrow">Customer care</p>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            Open a case to chat with the rider. Safety incidents stay separate
            and critical.
          </p>
        </div>
        <div className="doc-stat">
          <strong>{cases.filter((c) => c.status !== 'CLOSED').length}</strong>
          <span>Open threads</span>
        </div>
      </div>
      {error ? <p className="warn-text">{error}</p> : null}

      <section className="panel lime">
        <div className="panel-head">
          <h2>Safety incidents</h2>
        </div>
        {incidents.length === 0 ? (
          <p className="empty-state">No safety incidents.</p>
        ) : (
          <ul className="recent">
            {incidents.map((i, idx) => (
              <li key={i.incidentId ?? idx}>
                <span>
                  <span className="status-pill danger">
                    {i.priority ?? 'SAFETY'}
                  </span>{' '}
                  {i.subject} · {i.incidentId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Support inbox</h2>
        </div>
        {cases.length === 0 ? (
          <div className="empty-visual compact">
            <h2>No support cases yet</h2>
            <p>When a customer opens Help in the app, the thread lands here.</p>
          </div>
        ) : (
          <div className="chat-inbox">
            {cases.map((c) => (
              <Link
                key={c.caseId}
                href={`/support/${c.caseId}`}
                className="chat-inbox-row"
              >
                <div className="chat-inbox-main">
                  <div className="chat-inbox-top">
                    <strong>{c.subject ?? 'Support case'}</strong>
                    <span className="status-pill warn">
                      {c.priority ?? 'NORMAL'}
                    </span>
                    <span
                      className={`status-pill ${
                        c.status === 'CLOSED' || c.status === 'RESOLVED'
                          ? 'ok'
                          : 'live'
                      }`}
                    >
                      {c.status ?? 'OPEN'}
                    </span>
                  </div>
                  <p>
                    {c.lastMessagePreview ?? c.category ?? 'Tap to open chat'}
                  </p>
                  <small>
                    Case {shortId(c.caseId, 12)} · Customer{' '}
                    {shortId(c.ownerUid, 8)}
                    {c.bookingId ? ` · Booking ${shortId(c.bookingId, 10)}` : ''}
                    {' · '}
                    {when(c.updatedAt)}
                  </small>
                </div>
                <span className="chat-inbox-cta">Open chat</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
