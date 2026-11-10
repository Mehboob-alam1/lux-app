'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AdminShell } from '@/components/AdminShell';
import { getDb, getFirebaseFunctions } from '@/lib/firebase';

type Vehicle = {
  vehicleId: string;
  ownerDriverId?: string;
  make?: string;
  model?: string;
  plate?: string;
  year?: number;
  status?: string;
  inspectionStatus?: string;
  documentEligibilityOk?: boolean;
  classIds?: string[];
  reviewChecklist?: {
    plateVerified?: boolean;
    classConfirmed?: boolean;
    photosReviewed?: boolean;
    inspectionPassed?: boolean;
  };
  updatedAt?: string;
};

type Checklist = {
  plateVerified: boolean;
  classConfirmed: boolean;
  photosReviewed: boolean;
  inspectionPassed: boolean;
};

const emptyChecklist = (): Checklist => ({
  plateVerified: false,
  classConfirmed: false,
  photosReviewed: false,
  inspectionPassed: false,
});

export default function VehiclesPage() {
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState<Checklist>(emptyChecklist());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(collection(getDb(), 'vehicles'), orderBy('updatedAt', 'desc'), limit(80)),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as Vehicle;
            return { ...data, vehicleId: data.vehicleId ?? d.id };
          }),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => (r.status ?? 'PENDING') !== 'APPROVED');
  }, [rows, filter]);

  function openReview(v: Vehicle) {
    setSelected(v);
    setChecklist({
      plateVerified: Boolean(v.reviewChecklist?.plateVerified),
      classConfirmed: Boolean(v.reviewChecklist?.classConfirmed),
      photosReviewed: Boolean(v.reviewChecklist?.photosReviewed),
      inspectionPassed: Boolean(v.reviewChecklist?.inspectionPassed),
    });
    setNotes('');
    setMsg(null);
  }

  async function submit(decision: 'APPROVE' | 'REJECT') {
    if (!selected) return;
    setBusy(true);
    setMsg(decision === 'APPROVE' ? 'Approving vehicle…' : 'Rejecting…');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'reviewVehicle');
      const payload: Record<string, unknown> = {
        vehicleId: selected.vehicleId,
        decision,
        checklist,
      };
      const trimmed = notes.trim();
      if (trimmed) payload.notes = trimmed;
      const res = await fn(payload);
      const data = res.data as { status?: string; driverStatus?: string };
      setMsg(
        `Vehicle ${data.status}. Driver status: ${data.driverStatus ?? 'n/a'}`,
      );
      setSelected(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onApprove(e: FormEvent) {
    e.preventDefault();
    await submit('APPROVE');
  }

  return (
    <AdminShell title="Vehicles">
      <p className="page-lede">
        New vehicles start <strong>PENDING</strong>. Approve only after the full
        checklist. Document eligibility is a separate step under Documents.
      </p>
      {error ? <p className="warn-text">{error}</p> : null}
      {msg ? <p className="freshness">{msg}</p> : null}

      <div className="chip-row">
        <button
          type="button"
          className={`chip${filter === 'pending' ? ' active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Needs review
        </button>
        <button
          type="button"
          className={`chip${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-state">No vehicles in this filter.</p>
      ) : (
        <div className="table-shell">
          <table className="lux-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Plate</th>
                <th>Driver</th>
                <th>Status</th>
                <th>Inspection</th>
                <th>Docs OK</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr key={v.vehicleId}>
                  <td>
                    <strong>
                      {`${v.make ?? ''} ${v.model ?? ''}`.trim() || v.vehicleId}
                    </strong>
                    <div className="muted-mini">{v.vehicleId}</div>
                  </td>
                  <td>{v.plate ?? '—'}</td>
                  <td className="mono">{v.ownerDriverId ?? '—'}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        v.status === 'APPROVED'
                          ? 'ok'
                          : v.status === 'REJECTED'
                            ? 'danger'
                            : 'warn'
                      }`}
                    >
                      {v.status ?? 'PENDING'}
                    </span>
                  </td>
                  <td>{v.inspectionStatus ?? '—'}</td>
                  <td>{v.documentEligibilityOk ? 'yes' : 'no'}</td>
                  <td>
                    <button
                      type="button"
                      className="chip active"
                      onClick={() => openReview(v)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="assign-overlay" role="dialog" aria-modal="true">
          <form className="panel assign-panel" onSubmit={onApprove}>
            <div className="panel-head">
              <h2>Review vehicle</h2>
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <p className="page-lede">
              {selected.make} {selected.model} · {selected.plate} · driver{' '}
              <code>{selected.ownerDriverId}</code>
            </p>
            <p className="page-lede">
              Classes: {(selected.classIds ?? []).join(', ') || '—'}
            </p>

            {(
              [
                ['plateVerified', 'Plate / VIN verified against registration'],
                ['classConfirmed', 'Vehicle class capacity confirmed'],
                ['photosReviewed', 'Vehicle photos reviewed'],
                ['inspectionPassed', 'Safety inspection passed'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="check-row">
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  disabled={busy}
                  onChange={(e) =>
                    setChecklist((c) => ({ ...c, [key]: e.target.checked }))
                  }
                />
                {label}
              </label>
            ))}

            <label className="field-label" htmlFor="veh-notes">
              Notes
            </label>
            <input
              id="veh-notes"
              className="field-input"
              value={notes}
              disabled={busy}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional review notes"
            />

            <div className="assign-actions" style={{ display: 'flex', gap: 8 }}>
              <button type="submit" className="chip active" disabled={busy}>
                {busy ? 'Working…' : 'Approve vehicle'}
              </button>
              <button
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => submit('REJECT')}
              >
                Reject
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <style>{`
        .muted-mini { color: var(--lux-muted); font-size: 0.75rem; }
        .mono { font-family: ui-monospace, monospace; font-size: 0.78rem; }
        .assign-overlay {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(17, 24, 19, 0.45);
          display: grid; place-items: center; padding: 1rem;
        }
        .assign-panel {
          width: min(560px, 100%); max-height: 90vh; overflow: auto; margin: 0;
        }
        .field-label {
          display: block; font-size: 0.78rem; font-weight: 700;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--lux-muted); margin: 0.85rem 0 0.35rem;
        }
        .field-input {
          width: 100%; border: 1px solid var(--lux-line);
          border-radius: var(--lux-radius-sm); padding: 0.7rem 0.85rem;
          background: var(--lux-surface);
        }
        .check-row {
          display: flex; gap: 0.55rem; align-items: flex-start;
          margin: 0.55rem 0; font-size: 0.95rem;
        }
        .assign-actions { margin-top: 1rem; }
        .assign-actions button { border: 0; cursor: pointer; }
      `}</style>
    </AdminShell>
  );
}
