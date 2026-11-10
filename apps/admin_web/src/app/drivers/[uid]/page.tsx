'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
import { OpsMap } from '@/components/OpsMap';
import { getDb } from '@/lib/firebase';
import { money, shortId, when } from '@/lib/format';

export default function DriverDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const [driver, setDriver] = useState<Record<string, unknown> | null>(null);
  const [vehicle, setVehicle] = useState<Record<string, unknown> | null>(null);
  const [location, setLocation] = useState<Record<string, unknown> | null>(
    null,
  );
  const [docs, setDocs] = useState<Record<string, unknown>[]>([]);
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(
      doc(getDb(), 'drivers', uid),
      (snap) => {
        setDriver(snap.exists() ? { uid, ...snap.data()! } : null);
      },
      (err) => setError(err.message),
    );
    const uLoc = onSnapshot(
      doc(getDb(), 'driver_locations', uid),
      (snap) => setLocation(snap.exists() ? snap.data()! : null),
      () => undefined,
    );
    const uDocs = onSnapshot(
      query(
        collection(getDb(), 'driver_documents'),
        where('driverId', '==', uid),
        limit(20),
      ),
      (snap) => setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => undefined,
    );
    const uBook = onSnapshot(
      query(
        collection(getDb(), 'bookings'),
        where('assignedDriverId', '==', uid),
        orderBy('updatedAt', 'desc'),
        limit(20),
      ),
      (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => undefined,
    );
    return () => {
      u1();
      uLoc();
      uDocs();
      uBook();
    };
  }, [uid]);

  useEffect(() => {
    const vehicleId = driver?.currentVehicleId as string | undefined;
    if (!vehicleId) {
      setVehicle(null);
      return;
    }
    return onSnapshot(
      doc(getDb(), 'vehicles', vehicleId),
      (snap) => setVehicle(snap.exists() ? { vehicleId, ...snap.data()! } : null),
      () => undefined,
    );
  }, [driver?.currentVehicleId]);

  const mapPoints = useMemo(() => {
    const lat = Number(location?.lat);
    const lng = Number(location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng, label: String(driver?.displayName ?? 'Driver') }];
  }, [location, driver?.displayName]);

  return (
    <AdminShell title="Driver">
      <div className="chat-toolbar">
        <Link href="/drivers" className="btn-ghost">
          ← Drivers
        </Link>
        <Link href="/documents" className="btn-ghost">
          Documents queue
        </Link>
        <Link href="/vehicles" className="btn-ghost">
          Vehicles
        </Link>
      </div>
      {error ? <p className="warn-text">{error}</p> : null}

      {!driver ? (
        <p className="empty-state">Driver not found.</p>
      ) : (
        <>
          <section className="detail-hero panel">
            <div className="detail-avatar" aria-hidden>
              {String(driver.displayName ?? 'D')
                .slice(0, 1)
                .toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <p className="eyebrow">Driver profile</p>
              <h2>{String(driver.displayName ?? shortId(uid, 12))}</h2>
              <p className="doc-meta">
                {uid} · {String(driver.driverType ?? '—')}
              </p>
              <div className="chip-row" style={{ marginTop: 10, marginBottom: 0 }}>
                <span
                  className={`status-pill ${
                    driver.status === 'ACTIVE' ? 'ok' : 'warn'
                  }`}
                >
                  {String(driver.status)}
                </span>
                <span
                  className={`status-pill ${
                    driver.onlineState === 'ONLINE' ? 'live' : ''
                  }`}
                >
                  {String(driver.onlineState)}
                </span>
              </div>
              {driver.statusReason ? (
                <p className="doc-meta">{String(driver.statusReason)}</p>
              ) : null}
            </div>
          </section>

          <div className="detail-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Vehicle</h2>
              </div>
              {!vehicle ? (
                <p className="empty-state">No vehicle linked.</p>
              ) : (
                <div className="detail-kv">
                  <div>
                    <span>Vehicle</span>
                    <strong>
                      {String(vehicle.make)} {String(vehicle.model)} (
                      {String(vehicle.year ?? '')})
                    </strong>
                  </div>
                  <div>
                    <span>Plate</span>
                    <strong>{String(vehicle.plate ?? '—')}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{String(vehicle.status)}</strong>
                  </div>
                  <div>
                    <span>Docs eligible</span>
                    <strong>
                      {vehicle.documentEligibilityOk ? 'Yes' : 'No'}
                    </strong>
                  </div>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Live location</h2>
              </div>
              <OpsMap points={mapPoints} title="Driver pin" />
              {location ? (
                <p className="doc-meta">
                  Updated {when(location.updatedAt as string | undefined)}
                  {location.stale ? ' · stale' : ''}
                </p>
              ) : null}
            </section>
          </div>

          <div className="detail-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Documents</h2>
                <Link href="/documents" className="chip">
                  Review
                </Link>
              </div>
              {docs.length === 0 ? (
                <p className="empty-state">No checklist rows.</p>
              ) : (
                <ul className="recent">
                  {docs.map((d) => (
                    <li key={String(d.id)}>
                      <span>
                        <strong>{String(d.label ?? d.type)}</strong>
                        <span
                          className={`status-pill ${
                            d.status === 'APPROVED'
                              ? 'ok'
                              : d.status === 'SUBMITTED'
                                ? 'info'
                                : 'warn'
                          }`}
                        >
                          {String(d.status)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Assigned trips</h2>
              </div>
              {bookings.length === 0 ? (
                <p className="empty-state">No assigned bookings.</p>
              ) : (
                <ul className="recent">
                  {bookings.map((b) => (
                    <li key={String(b.id)}>
                      <Link href={`/bookings/${String(b.bookingId ?? b.id)}`}>
                        <strong>
                          {shortId(String(b.bookingId ?? b.id), 14)}
                        </strong>
                        <span className="status-pill live">
                          {String(b.currentStatus)}
                        </span>
                      </Link>
                      <small className="detail-sub">
                        {money(
                          b.customerPriceMinor as number | undefined,
                          String(b.currency ?? 'CAD'),
                        )}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AdminShell>
  );
}
