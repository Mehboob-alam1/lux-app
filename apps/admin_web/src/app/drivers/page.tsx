'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import { AdminShell } from '@/components/AdminShell';
import { getDb } from '@/lib/firebase';
import { shortId } from '@/lib/format';

type Driver = {
  uid: string;
  displayName?: string;
  status?: string;
  onlineState?: string;
  driverType?: string;
  statusReason?: string;
  currentVehicleId?: string;
};

export default function DriversPage() {
  const [rows, setRows] = useState<Driver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(collection(getDb(), 'drivers'), limit(80),
      ),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as Driver;
            return { ...data, uid: data.uid ?? d.id };
          }),
        );
        setFreshAt(new Date().toISOString());
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, []);

  const online = rows.filter((d) => d.onlineState === 'ONLINE').length;

  return (
    <AdminShell title="Drivers">
      <div className="doc-hero">
        <div>
          <p className="eyebrow">Fleet partners</p>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            Tap a driver for vehicle, documents, live map pin, and assigned
            trips.
          </p>
        </div>
        <div className="doc-stat-row">
          <div className="doc-stat">
            <strong>{online}</strong>
            <span>Online</span>
          </div>
          <div className="doc-stat muted">
            <strong>{rows.length}</strong>
            <span>Total</span>
          </div>
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
          <h2>No drivers yet</h2>
          <p>Driver app signups provision checklist + vehicle automatically.</p>
        </div>
      ) : (
        <div className="people-grid">
          {rows.map((d) => (
            <Link key={d.uid} href={`/drivers/${d.uid}`} className="people-card">
              <div className="detail-avatar sm" aria-hidden>
                {String(d.displayName ?? 'D')
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div>
                <strong>{d.displayName ?? shortId(d.uid, 12)}</strong>
                <div className="chip-row" style={{ margin: '0.35rem 0' }}>
                  <span
                    className={`status-pill ${
                      d.status === 'ACTIVE' ? 'ok' : 'warn'
                    }`}
                  >
                    {d.status}
                  </span>
                  <span
                    className={`status-pill ${
                      d.onlineState === 'ONLINE' ? 'live' : ''
                    }`}
                  >
                    {d.onlineState}
                  </span>
                </div>
                <small>
                  {d.driverType ?? '—'}
                  {d.currentVehicleId
                    ? ` · veh ${shortId(d.currentVehicleId, 8)}`
                    : ''}
                </small>
                {d.statusReason ? <small>{d.statusReason}</small> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
