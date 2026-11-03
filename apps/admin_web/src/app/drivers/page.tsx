'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';

type Driver = {
  uid: string;
  displayName?: string;
  status?: string;
  onlineState?: string;
  driverType?: string;
  statusReason?: string;
};

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(collection(getDb(), 'drivers'), limit(50)),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as Driver;
            return { ...data, uid: data.uid ?? d.id };
          }),
        );
        setFreshAt(new Date().toISOString());
      },
      (err) => setError(err.message),
    );
  }, []);

  return (
    <AdminShell title="Drivers">
      <p className="page-lede">
        Owner-driver focus this release. Fleet drivers are not managed here yet.
      </p>
      <p className={`freshness${freshAt ? '' : ' warn'}`} role="status">
        {freshAt ? `Data fresh at ${freshAt}` : 'Connecting…'}
      </p>
      {error ? <p className="warn-text">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="empty-state">No drivers loaded.</p>
      ) : (
        <div className="table-shell">
          <table className="lux-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Online</th>
                <th>Type</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.uid}>
                  <td>
                    <strong>{d.displayName ?? d.uid}</strong>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${d.status === 'ACTIVE' ? 'ok' : 'warn'}`}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`status-pill ${d.onlineState === 'ONLINE' ? 'live' : ''}`}
                    >
                      {d.onlineState}
                    </span>
                  </td>
                  <td>{d.driverType}</td>
                  <td>{d.statusReason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
