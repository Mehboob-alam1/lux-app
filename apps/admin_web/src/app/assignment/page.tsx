'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { logError, logInfo, timed } from '@/lib/logger';

type Booking = {
  bookingId: string;
  currentStatus: string;
  classId?: string;
  riskState?: string;
  customerPriceMinor?: number;
  currency?: string;
  marketId?: string;
};

type Driver = {
  uid: string;
  displayName?: string;
  status?: string;
  onlineState?: string;
  currentVehicleId?: string;
  marketIds?: string[];
};

type Vehicle = {
  vehicleId: string;
  ownerDriverId?: string;
  status?: string;
  documentEligibilityOk?: boolean;
  classIds?: string[];
  make?: string;
  model?: string;
  plate?: string;
};

export default function AssignmentPage() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [driverQuery, setDriverQuery] = useState('');
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [allowUpgrade, setAllowUpgrade] = useState(false);
  const [reason, setReason] = useState('Manual rescue assignment');

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

  useEffect(() => {
    const unsubDrivers = onSnapshot(
      query(collection(getDb(), 'drivers'), limit(80)),
      (snap) => {
        setDrivers(
          snap.docs.map((d) => {
            const data = d.data() as Driver;
            return { ...data, uid: data.uid ?? d.id };
          }),
        );
      },
      (err) => setError(err.message),
    );
    const unsubVehicles = onSnapshot(
      query(collection(getDb(), 'vehicles'), limit(120)),
      (snap) => {
        setVehicles(
          snap.docs.map((d) => {
            const data = d.data() as Vehicle;
            return { ...data, vehicleId: data.vehicleId ?? d.id };
          }),
        );
      },
      (err) => setError(err.message),
    );
    return () => {
      unsubDrivers();
      unsubVehicles();
    };
  }, []);

  const filteredDrivers = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    return drivers
      .filter((d) => {
        if (!q) return true;
        return (
          d.uid.toLowerCase().includes(q) ||
          (d.displayName ?? '').toLowerCase().includes(q) ||
          (d.status ?? '').toLowerCase().includes(q) ||
          (d.onlineState ?? '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const score = (d: Driver) =>
          (d.status === 'ACTIVE' ? 4 : 0) +
          (d.onlineState === 'ONLINE' ? 2 : 0) +
          (d.currentVehicleId ? 1 : 0);
        return score(b) - score(a);
      });
  }, [drivers, driverQuery]);

  const driverVehicles = useMemo(() => {
    if (!driverId) return [] as Vehicle[];
    return vehicles.filter((v) => v.ownerDriverId === driverId);
  }, [vehicles, driverId]);

  useEffect(() => {
    if (!driverId) {
      setVehicleId('');
      return;
    }
    const driver = drivers.find((d) => d.uid === driverId);
    const preferred = driver?.currentVehicleId;
    if (preferred && driverVehicles.some((v) => v.vehicleId === preferred)) {
      setVehicleId(preferred);
      return;
    }
    const approved = driverVehicles.find(
      (v) => v.status === 'APPROVED' && v.documentEligibilityOk,
    );
    setVehicleId(approved?.vehicleId ?? driverVehicles[0]?.vehicleId ?? '');
  }, [driverId, drivers, driverVehicles]);

  async function seedCatalog() {
    setMsg('Seeding demo catalog…');
    try {
      await timed('ensure_demo_catalog', async () => {
        const fn = httpsCallable(getFirebaseFunctions(), 'ensureDemoCatalog');
        await fn({});
      });
      setMsg('Demo catalog ready (market yyz + pricing + classes)');
      logInfo('demo_catalog_ready');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setMsg(message);
      logError('demo_catalog_failed', { error: message });
    }
  }

  function openAssign(booking: Booking) {
    setSelectedBooking(booking);
    setDriverQuery('');
    setDriverId('');
    setVehicleId('');
    setAllowUpgrade(false);
    setReason('Manual rescue assignment');
    setMsg(null);
  }

  async function submitAssign(e: FormEvent) {
    e.preventDefault();
    if (!selectedBooking) return;
    if (!driverId || !vehicleId) {
      setMsg('Select an eligible driver and vehicle.');
      return;
    }
    setBusy(true);
    setMsg('Assigning…');
    try {
      await timed(
        'admin_assign_booking',
        async () => {
          const fn = httpsCallable(getFirebaseFunctions(), 'adminAssignBooking');
          await fn({
            idempotencyKey: `admin_assign_${selectedBooking.bookingId}_${Date.now()}`,
            marketId: selectedBooking.marketId ?? 'yyz',
            bookingId: selectedBooking.bookingId,
            driverId,
            vehicleId,
            reason: reason.trim() || 'Manual rescue assignment',
            allowUpgradeComplimentary: allowUpgrade,
          });
        },
        { bookingId: selectedBooking.bookingId },
      );
      setMsg(`Assigned ${selectedBooking.bookingId} → ${driverId}`);
      logInfo('admin_assign_ok', {
        bookingId: selectedBooking.bookingId,
        driverId,
        vehicleId,
      });
      setSelectedBooking(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMsg(message);
      logError('admin_assign_failed', {
        bookingId: selectedBooking.bookingId,
        error: message,
      });
    } finally {
      setBusy(false);
    }
  }

  const selectedVehicle = vehicles.find((v) => v.vehicleId === vehicleId);
  const classMismatch =
    !!selectedBooking?.classId &&
    !!selectedVehicle &&
    !(selectedVehicle.classIds ?? []).includes(selectedBooking.classId);

  return (
    <AdminShell title="Assignment & Rescue">
      <div className="doc-hero">
        <div>
          <p className="eyebrow">Dispatch desk</p>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            Bookings in ASSIGNMENT_PENDING or REASSIGNING. Assign an ACTIVE
            driver with an APPROVED, docs-eligible vehicle.
          </p>
        </div>
        <div className="doc-stat">
          <strong>{rows.length}</strong>
          <span>In queue</span>
        </div>
      </div>
      <div className="chip-row">
        <button type="button" className="chip" onClick={seedCatalog}>
          Ensure demo catalog
        </button>
        <a href="/bookings" className="chip">
          All bookings
        </a>
        <a href="/drivers" className="chip">
          Drivers
        </a>
      </div>
      {error ? <p className="warn-text">{error}</p> : null}
      {msg ? <p className="freshness">{msg}</p> : null}

      {rows.length === 0 ? (
        <div className="empty-visual">
          <div className="empty-visual-mark" aria-hidden />
          <h2>Rescue queue is clear</h2>
          <p>
            Nothing needs manual assignment right now. When a booking is
            unassigned or a driver cancels, it appears here for rescue.
          </p>
        </div>
      ) : (
        <div className="booking-card-grid">
          {rows.map((b) => (
            <article key={b.bookingId} className="booking-card">
              <div className="booking-card-top">
                <strong>{b.bookingId}</strong>
                <span className="status-pill warn">{b.currentStatus}</span>
              </div>
              <div className="booking-card-meta">
                <span>{b.classId ?? '—'}</span>
                <span>risk {b.riskState ?? 'NORMAL'}</span>
                <span>
                  {b.customerPriceMinor != null
                    ? `${(b.customerPriceMinor / 100).toFixed(2)} ${b.currency ?? ''}`
                    : '—'}
                </span>
              </div>
              <div className="booking-card-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => openAssign(b)}
                >
                  Assign / rescue
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedBooking ? (
        <div className="assign-overlay" role="dialog" aria-modal="true">
          <form className="panel assign-panel" onSubmit={submitAssign}>
            <div className="panel-head">
              <h2>Assign {selectedBooking.bookingId}</h2>
              <button
                type="button"
                className="chip"
                onClick={() => setSelectedBooking(null)}
                disabled={busy}
              >
                Close
              </button>
            </div>
            <p className="page-lede">
              Needs class {selectedBooking.classId ?? '—'} · market{' '}
              {selectedBooking.marketId ?? 'yyz'}
            </p>

            <label className="field-label" htmlFor="driver-search">
              Search drivers
            </label>
            <input
              id="driver-search"
              className="field-input"
              value={driverQuery}
              onChange={(e) => setDriverQuery(e.target.value)}
              placeholder="Name, uid, status, online…"
              disabled={busy}
            />

            <div className="driver-picker">
              {filteredDrivers.length === 0 ? (
                <p className="empty-state">No drivers match.</p>
              ) : (
                filteredDrivers.slice(0, 12).map((d) => {
                  const selected = d.uid === driverId;
                  const eligible = d.status === 'ACTIVE';
                  return (
                    <button
                      key={d.uid}
                      type="button"
                      className={`driver-option${selected ? ' selected' : ''}`}
                      onClick={() => setDriverId(d.uid)}
                      disabled={busy}
                    >
                      <span>
                        <strong>{d.displayName ?? d.uid}</strong>
                        <small>{d.uid}</small>
                      </span>
                      <span className="driver-tags">
                        <span
                          className={`status-pill ${eligible ? 'ok' : 'warn'}`}
                        >
                          {d.status ?? '—'}
                        </span>
                        <span
                          className={`status-pill ${
                            d.onlineState === 'ONLINE' ? 'live' : ''
                          }`}
                        >
                          {d.onlineState ?? 'OFFLINE'}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <label className="field-label" htmlFor="vehicle-select">
              Vehicle
            </label>
            <select
              id="vehicle-select"
              className="field-input"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              disabled={busy || !driverId}
            >
              <option value="">Select vehicle</option>
              {driverVehicles.map((v) => (
                <option key={v.vehicleId} value={v.vehicleId}>
                  {v.make ?? ''} {v.model ?? ''} · {v.plate ?? v.vehicleId} ·{' '}
                  {v.status}
                  {v.documentEligibilityOk ? '' : ' · docs blocked'}
                </option>
              ))}
            </select>

            {classMismatch ? (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={allowUpgrade}
                  onChange={(e) => setAllowUpgrade(e.target.checked)}
                  disabled={busy}
                />
                Allow complimentary class upgrade (customer price protected)
              </label>
            ) : null}

            <label className="field-label" htmlFor="assign-reason">
              Reason
            </label>
            <input
              id="assign-reason"
              className="field-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
            />

            <div className="assign-actions">
              <button
                type="submit"
                className="chip active"
                disabled={busy || !driverId || !vehicleId}
              >
                {busy ? 'Assigning…' : 'Confirm assign'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <style>{`
        .rescue-list { display: grid; gap: 0.75rem; }
        .rescue-card { display: grid; gap: 0.75rem; margin-bottom: 0; }
        .rescue-meta { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; }
        .rescue-card button, .assign-actions button { justify-self: start; border: 0; cursor: pointer; }
        .assign-overlay {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(17, 24, 19, 0.45);
          display: grid; place-items: center;
          padding: 1rem;
        }
        .assign-panel {
          width: min(560px, 100%);
          max-height: min(90vh, 820px);
          overflow: auto;
          margin: 0;
        }
        .field-label {
          display: block;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--lux-muted);
          margin: 0.85rem 0 0.35rem;
        }
        .field-input {
          width: 100%;
          border: 1px solid var(--lux-line);
          border-radius: var(--lux-radius-sm);
          padding: 0.7rem 0.85rem;
          background: var(--lux-surface);
        }
        .driver-picker {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.55rem;
          max-height: 240px;
          overflow: auto;
        }
        .driver-option {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          align-items: center;
          text-align: left;
          border: 1px solid var(--lux-line);
          border-radius: var(--lux-radius-sm);
          background: var(--lux-surface);
          padding: 0.7rem 0.8rem;
          cursor: pointer;
        }
        .driver-option.selected {
          border-color: var(--lux-ink);
          background: color-mix(in srgb, var(--lux-lime) 28%, white);
        }
        .driver-option strong { display: block; }
        .driver-option small { color: var(--lux-muted); font-size: 0.75rem; }
        .driver-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .check-row {
          display: flex;
          gap: 0.55rem;
          align-items: flex-start;
          margin-top: 0.75rem;
          font-size: 0.92rem;
        }
        .assign-actions { margin-top: 1rem; }
      `}</style>
    </AdminShell>
  );
}
