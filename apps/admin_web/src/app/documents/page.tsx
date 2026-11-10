'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref } from 'firebase/storage';
import { AdminShell } from '@/components/AdminShell';
import {
  getDb,
  getFirebaseFunctions,
  getFirebaseStorage,
} from '@/lib/firebase';

type DriverDoc = {
  documentId: string;
  driverId: string;
  vehicleId: string;
  type: string;
  label?: string;
  status?: string;
  required?: boolean;
  storagePath?: string | null;
  contentType?: string | null;
  fileName?: string | null;
  reviewNotes?: string | null;
  updatedAt?: string;
};

type Group = {
  key: string;
  driverId: string;
  vehicleId: string;
  docs: DriverDoc[];
};

export default function DocumentsPage() {
  const [rows, setRows] = useState<DriverDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(
        collection(getDb(), 'driver_documents'),
        orderBy('updatedAt', 'desc'),
        limit(200),
      ),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as DriverDoc;
            return { ...data, documentId: data.documentId ?? d.id };
          }),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const doc of rows) {
      if (filter === 'pending' && doc.status === 'APPROVED') continue;
      const key = `${doc.driverId}__${doc.vehicleId}`;
      const existing = map.get(key);
      if (existing) existing.docs.push(doc);
      else {
        map.set(key, {
          key,
          driverId: doc.driverId,
          vehicleId: doc.vehicleId,
          docs: [doc],
        });
      }
    }
    return Array.from(map.values());
  }, [rows, filter]);

  async function openFile(doc: DriverDoc) {
    if (!doc.storagePath) {
      setMsg('No file uploaded yet for this document');
      return;
    }
    setPreviewBusy(doc.documentId);
    setMsg(null);
    try {
      const url = await getDownloadURL(
        ref(getFirebaseStorage(), doc.storagePath),
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewBusy(null);
    }
  }

  async function reviewOne(
    documentId: string,
    decision: 'APPROVE' | 'REJECT',
  ) {
    setBusyId(documentId);
    setMsg(null);
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'reviewDriverDocument');
      await fn({ documentId, decision });
      setMsg(`Document ${decision === 'APPROVE' ? 'approved' : 'rejected'}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function finalize(
    group: Group,
    decision: 'APPROVE_ELIGIBILITY' | 'REVOKE_ELIGIBILITY',
  ) {
    setBusyId(group.key);
    setMsg(null);
    try {
      const fn = httpsCallable(
        getFirebaseFunctions(),
        'finalizeDocumentEligibility',
      );
      const res = await fn({
        driverId: group.driverId,
        vehicleId: group.vehicleId,
        decision,
      });
      const data = res.data as {
        documentEligibilityOk?: boolean;
        driverStatus?: string;
      };
      setMsg(
        decision === 'APPROVE_ELIGIBILITY'
          ? `Docs eligible. Driver → ${data.driverStatus ?? 'n/a'}`
          : `Eligibility revoked. Driver → ${data.driverStatus ?? 'PENDING'}`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Documents">
      <p className="page-lede">
        Drivers upload licence, insurance, registration, and inspection files.
        Open the file, approve each item, then{' '}
        <strong>Approve eligibility</strong> (vehicle must also be APPROVED).
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
          All groups
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="empty-state">
          No document checklist rows yet. New driver signups create them
          automatically.
        </p>
      ) : (
        <div className="doc-groups">
          {groups.map((g) => {
            const allApproved = g.docs.every((d) => d.status === 'APPROVED');
            const pendingCount = g.docs.filter(
              (d) => d.status !== 'APPROVED',
            ).length;
            const submittedCount = g.docs.filter(
              (d) => d.status === 'SUBMITTED',
            ).length;
            return (
              <article key={g.key} className="panel">
                <div className="panel-head">
                  <h2>
                    Driver <code>{g.driverId.slice(0, 10)}…</code>
                  </h2>
                  <span className="status-pill warn">
                    {submittedCount} submitted · {pendingCount} open
                  </span>
                </div>
                <p className="page-lede">
                  Vehicle <code>{g.vehicleId}</code>
                </p>
                <div className="table-shell">
                  <table className="lux-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>File</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {g.docs.map((d) => {
                        const canApprove =
                          d.status === 'SUBMITTED' && Boolean(d.storagePath);
                        return (
                          <tr key={d.documentId}>
                            <td>
                              <strong>{d.label ?? d.type}</strong>
                              <div className="muted-mini">{d.type}</div>
                            </td>
                            <td>
                              {d.storagePath ? (
                                <button
                                  type="button"
                                  className="chip"
                                  disabled={previewBusy === d.documentId}
                                  onClick={() => openFile(d)}
                                >
                                  {previewBusy === d.documentId
                                    ? 'Opening…'
                                    : d.fileName ?? 'Open file'}
                                </button>
                              ) : (
                                <span className="muted-mini">
                                  Waiting for driver upload
                                </span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`status-pill ${
                                  d.status === 'APPROVED'
                                    ? 'ok'
                                    : d.status === 'REJECTED'
                                      ? 'danger'
                                      : d.status === 'SUBMITTED'
                                        ? 'ok'
                                        : 'warn'
                                }`}
                              >
                                {d.status ?? 'PENDING'}
                              </span>
                            </td>
                            <td className="actions">
                              <button
                                type="button"
                                className="chip active"
                                disabled={busyId !== null || !canApprove}
                                title={
                                  canApprove
                                    ? 'Approve uploaded document'
                                    : 'Driver must upload first'
                                }
                                onClick={() =>
                                  reviewOne(d.documentId, 'APPROVE')
                                }
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="chip"
                                disabled={
                                  busyId !== null || d.status === 'APPROVED'
                                }
                                onClick={() =>
                                  reviewOne(d.documentId, 'REJECT')
                                }
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  className="assign-actions"
                  style={{ display: 'flex', gap: 8 }}
                >
                  <button
                    type="button"
                    className="chip active"
                    disabled={busyId !== null || !allApproved}
                    title={
                      allApproved
                        ? 'Mark vehicle documents eligible'
                        : 'Approve every required document first'
                    }
                    onClick={() => finalize(g, 'APPROVE_ELIGIBILITY')}
                  >
                    {busyId === g.key
                      ? 'Working…'
                      : 'Approve document eligibility'}
                  </button>
                  <button
                    type="button"
                    className="chip"
                    disabled={busyId !== null}
                    onClick={() => finalize(g, 'REVOKE_ELIGIBILITY')}
                  >
                    Revoke eligibility
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .doc-groups { display: grid; gap: 1rem; }
        .muted-mini { color: var(--lux-muted); font-size: 0.75rem; }
        .actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .actions button, .assign-actions button { border: 0; cursor: pointer; }
        .assign-actions { margin-top: 0.85rem; }
      `}</style>
    </AdminShell>
  );
}
