'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';

export default function SupportPage() {
  const [cases, setCases] = useState<
    { caseId?: string; subject?: string; priority?: string; status?: string }[]
  >([]);
  const [incidents, setIncidents] = useState<
    { incidentId?: string; subject?: string; priority?: string }[]
  >([]);

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(getDb(), 'support_cases'), orderBy('updatedAt', 'desc'), limit(40)),
      (s) => setCases(s.docs.map((d) => d.data() as (typeof cases)[0])),
      () => undefined,
    );
    const u2 = onSnapshot(
      query(collection(getDb(), 'incidents'), orderBy('updatedAt', 'desc'), limit(20)),
      (s) => setIncidents(s.docs.map((d) => d.data() as (typeof incidents)[0])),
      () => undefined,
    );
    return () => {
      u1();
      u2();
    };
  }, []);

  return (
    <AdminShell title="Help & Support">
      <p className="page-lede">
        Help solves problems. Disputes adjudicate claims. Safety is separate and
        critical.
      </p>

      <section className="panel lime">
        <h2>Safety incidents</h2>
        {incidents.length === 0 ? (
          <p className="empty-state">No open incidents loaded.</p>
        ) : (
          <ul className="recent">
            {incidents.map((i, idx) => (
              <li key={idx}>
                <span>
                  <span className="status-pill danger">{i.priority ?? 'SAFETY'}</span>{' '}
                  {i.subject} · {i.incidentId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>Support inbox</h2>
        {cases.length === 0 ? (
          <p className="empty-state">No support cases.</p>
        ) : (
          <div className="table-shell" style={{ boxShadow: 'none', border: 0 }}>
            <table className="lux-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c, i) => (
                  <tr key={i}>
                    <td>
                      <span className="status-pill warn">{c.priority ?? '—'}</span>
                    </td>
                    <td>{c.status}</td>
                    <td>{c.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
