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
  uploadedAt?: string | null;
  updatedAt?: string;
};

type Group = {
  key: string;
  driverId: string;
  vehicleId: string;
  docs: DriverDoc[];
};

function statusTone(status?: string) {
  if (status === 'APPROVED') return 'ok';
  if (status === 'REJECTED') return 'danger';
  if (status === 'SUBMITTED') return 'info';
  return 'warn';
}

function isImage(contentType?: string | null, fileName?: string | null) {
  if (contentType?.startsWith('image/')) return true;
  const n = (fileName ?? '').toLowerCase();
  return /\.(jpe?g|png|webp)$/.test(n);
}

export default function DocumentsPage() {
  const [rows, setRows] = useState<DriverDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'queue' | 'all'>('queue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    return onSnapshot(
      query(
        collection(getDb(), 'driver_documents'),
        orderBy('updatedAt', 'desc'),
        limit(200),
      ),
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() as DriverDoc;
          return { ...data, documentId: data.documentId ?? d.id };
        });
        setRows(next);
        setError(null);
        setSelectedId((prev) => {
          if (prev && next.some((d) => d.documentId === prev)) return prev;
          const prefer =
            next.find((d) => d.status === 'SUBMITTED' && d.storagePath) ??
            next.find((d) => d.status !== 'APPROVED') ??
            next[0];
          return prefer?.documentId ?? null;
        });
      },
      (err) => setError(err.message),
    );
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const doc of rows) {
      if (filter === 'queue' && doc.status === 'APPROVED') continue;
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
    return Array.from(map.values()).sort((a, b) => {
      const aSub = a.docs.filter((d) => d.status === 'SUBMITTED').length;
      const bSub = b.docs.filter((d) => d.status === 'SUBMITTED').length;
      return bSub - aSub;
    });
  }, [rows, filter]);

  const selected = useMemo(
    () => rows.find((d) => d.documentId === selectedId) ?? null,
    [rows, selectedId],
  );

  const selectedGroup = useMemo(() => {
    if (!selected) return null;
    return (
      groups.find(
        (g) =>
          g.driverId === selected.driverId &&
          g.vehicleId === selected.vehicleId,
      ) ?? null
    );
  }, [groups, selected]);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl(null);
    setPreviewError(null);
    setLightbox(false);

    if (!selected?.storagePath) {
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    getDownloadURL(ref(getFirebaseStorage(), selected.storagePath))
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url);
          setPreviewLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPreviewError(e instanceof Error ? e.message : String(e));
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.documentId, selected?.storagePath]);

  const queueCount = rows.filter((d) => d.status === 'SUBMITTED').length;
  const waitingUpload = rows.filter(
    (d) => d.status === 'PENDING' || (!d.storagePath && d.status !== 'APPROVED'),
  ).length;

  async function reviewOne(
    documentId: string,
    decision: 'APPROVE' | 'REJECT',
    notes?: string,
  ) {
    setBusyId(documentId);
    setMsg(null);
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'reviewDriverDocument');
      const payload: Record<string, unknown> = { documentId, decision };
      const trimmed = notes?.trim();
      if (trimmed) payload.notes = trimmed;
      await fn(payload);
      setMsg(
        decision === 'APPROVE'
          ? 'Document approved'
          : 'Document rejected — driver can re-upload',
      );
      setRejectOpen(false);
      setRejectNotes('');
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
      const data = res.data as { driverStatus?: string };
      setMsg(
        decision === 'APPROVE_ELIGIBILITY'
          ? `Eligibility approved · driver → ${data.driverStatus ?? 'ACTIVE/PENDING'}`
          : `Eligibility revoked · driver → ${data.driverStatus ?? 'PENDING'}`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const canApprove =
    selected?.status === 'SUBMITTED' && Boolean(selected.storagePath);
  const canReject = selected && selected.status !== 'APPROVED';
  const showImage =
    selected &&
    previewUrl &&
    isImage(selected.contentType, selected.fileName);

  return (
    <AdminShell title="Documents">
      <div className="doc-hero">
        <div>
          <p className="eyebrow">Compliance review</p>
          <p className="page-lede" style={{ marginBottom: 0 }}>
            Inspect the uploaded file, then approve or reject. When every
            required doc is approved, unlock eligibility so the driver can go
            online.
          </p>
        </div>
        <div className="doc-stat-row">
          <div className="doc-stat">
            <strong>{queueCount}</strong>
            <span>Ready to review</span>
          </div>
          <div className="doc-stat muted">
            <strong>{waitingUpload}</strong>
            <span>Awaiting upload</span>
          </div>
        </div>
      </div>

      {error ? <p className="warn-text">{error}</p> : null}
      {msg ? <p className="freshness">{msg}</p> : null}

      <div className="chip-row">
        <button
          type="button"
          className={`chip${filter === 'queue' ? ' active' : ''}`}
          onClick={() => setFilter('queue')}
        >
          Review queue
        </button>
        <button
          type="button"
          className={`chip${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All documents
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-visual">
          <div className="empty-visual-mark" aria-hidden />
          <h2>No documents in this view</h2>
          <p>
            When a driver uploads licence, insurance, registration, or
            inspection photos, they appear here for review.
          </p>
        </div>
      ) : (
        <div className="doc-workspace">
          <aside className="doc-queue" aria-label="Document queue">
            {groups.map((g) => {
              const submitted = g.docs.filter(
                (d) => d.status === 'SUBMITTED',
              ).length;
              const approved = g.docs.filter(
                (d) => d.status === 'APPROVED',
              ).length;
              return (
                <div key={g.key} className="doc-group">
                  <div className="doc-group-head">
                    <div>
                      <div className="doc-group-title">
                        Driver {g.driverId.slice(0, 8)}…
                      </div>
                      <div className="doc-group-sub">
                        Vehicle {g.vehicleId.slice(0, 12)}…
                      </div>
                    </div>
                    <span className="status-pill warn">
                      {submitted} new · {approved}/{g.docs.length}
                    </span>
                  </div>
                  <div className="doc-thumb-list">
                    {g.docs.map((d) => {
                      const active = d.documentId === selectedId;
                      return (
                        <button
                          key={d.documentId}
                          type="button"
                          className={`doc-queue-item${active ? ' active' : ''}`}
                          onClick={() => setSelectedId(d.documentId)}
                        >
                          <span
                            className={`doc-queue-dot ${statusTone(d.status)}`}
                          />
                          <span className="doc-queue-copy">
                            <strong>{d.label ?? d.type}</strong>
                            <small>
                              {d.storagePath
                                ? d.status === 'SUBMITTED'
                                  ? 'Uploaded · tap to inspect'
                                  : d.status
                                : 'No file yet'}
                            </small>
                          </span>
                          <span
                            className={`status-pill ${statusTone(d.status)}`}
                          >
                            {d.status ?? 'PENDING'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="doc-group-actions">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={
                        busyId !== null ||
                        !g.docs.every((d) => d.status === 'APPROVED')
                      }
                      onClick={() => finalize(g, 'APPROVE_ELIGIBILITY')}
                    >
                      Unlock eligibility
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={busyId !== null}
                      onClick={() => finalize(g, 'REVOKE_ELIGIBILITY')}
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </aside>

          <section className="doc-stage" aria-label="Document preview">
            {!selected ? (
              <div className="empty-visual compact">
                <h2>Select a document</h2>
                <p>Choose an item from the queue to preview and decide.</p>
              </div>
            ) : (
              <>
                <header className="doc-stage-head">
                  <div>
                    <p className="eyebrow">{selected.type}</p>
                    <h2>{selected.label ?? selected.type}</h2>
                    <p className="doc-meta">
                      {selected.fileName ?? 'No filename'} · Driver{' '}
                      {selected.driverId.slice(0, 10)}…
                      {selected.uploadedAt
                        ? ` · uploaded ${new Date(selected.uploadedAt).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${statusTone(selected.status)}`}
                  >
                    {selected.status ?? 'PENDING'}
                  </span>
                </header>

                <div className="doc-preview-frame">
                  {!selected.storagePath ? (
                    <div className="empty-visual compact">
                      <h2>Waiting for upload</h2>
                      <p>
                        Driver has not submitted this file yet. Approve is
                        blocked until a photo is on file.
                      </p>
                    </div>
                  ) : previewLoading ? (
                    <div className="doc-preview-loading">Loading preview…</div>
                  ) : previewError ? (
                    <div className="empty-visual compact">
                      <h2>Could not load file</h2>
                      <p>{previewError}</p>
                    </div>
                  ) : showImage ? (
                    <button
                      type="button"
                      className="doc-preview-image-wrap"
                      onClick={() => setLightbox(true)}
                      title="Open full size"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl!}
                        alt={selected.label ?? 'Document preview'}
                        className="doc-preview-image"
                      />
                      <span className="doc-preview-hint">Click to enlarge</span>
                    </button>
                  ) : (
                    <div className="empty-visual compact">
                      <h2>File ready</h2>
                      <p>{selected.fileName ?? selected.contentType}</p>
                      {previewUrl ? (
                        <a
                          className="btn-primary"
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open file
                        </a>
                      ) : null}
                    </div>
                  )}
                </div>

                {selected.reviewNotes ? (
                  <p className="doc-notes">
                    Last review note: {selected.reviewNotes}
                  </p>
                ) : null}

                <div className="doc-decision-bar">
                  <button
                    type="button"
                    className="btn-approve"
                    disabled={busyId !== null || !canApprove}
                    title={
                      canApprove
                        ? 'Approve this uploaded document'
                        : 'Driver must upload before approval'
                    }
                    onClick={() =>
                      selected && reviewOne(selected.documentId, 'APPROVE')
                    }
                  >
                    {busyId === selected.documentId
                      ? 'Working…'
                      : 'Approve document'}
                  </button>
                  <button
                    type="button"
                    className="btn-reject"
                    disabled={busyId !== null || !canReject}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </button>
                  {previewUrl ? (
                    <a
                      className="btn-ghost"
                      href={previewUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original
                    </a>
                  ) : null}
                </div>

                {selectedGroup ? (
                  <div className="doc-checklist">
                    <h3>Checklist for this vehicle</h3>
                    <ul>
                      {selectedGroup.docs.map((d) => (
                        <li key={d.documentId}>
                          <span
                            className={`doc-queue-dot ${statusTone(d.status)}`}
                          />
                          {d.label ?? d.type}
                          <em>{d.status}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}

      {rejectOpen && selected ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
          >
            <h2 id="reject-title">Reject document</h2>
            <p className="page-lede">
              Tell the driver what to fix. They can replace the file from the
              driver app.
            </p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              placeholder="e.g. Licence photo is blurry — retake with full card visible"
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setRejectOpen(false);
                  setRejectNotes('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-reject"
                disabled={busyId !== null}
                onClick={() =>
                  reviewOne(selected.documentId, 'REJECT', rejectNotes.trim())
                }
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {lightbox && previewUrl ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightbox(false);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Full document" />
        </div>
      ) : null}
    </AdminShell>
  );
}
