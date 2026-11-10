'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AdminShell } from '@/components/AdminShell';
import { useAuth } from '@/lib/auth';
import { getDb, getFirebaseFunctions } from '@/lib/firebase';
import { shortId, when } from '@/lib/format';

type SupportCase = {
  caseId: string;
  subject?: string;
  status?: string;
  priority?: string;
  category?: string;
  ownerUid?: string;
  bookingId?: string | null;
  context?: Record<string, unknown>;
};

type Message = {
  messageId: string;
  authorUid?: string;
  authorRole?: string;
  body?: string;
  visibility?: string;
  createdAt?: string;
};

const STATUSES = [
  'OPEN',
  'PENDING_CUSTOMER',
  'PENDING_INTERNAL',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
] as const;

export default function SupportCasePage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();
  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubCase = onSnapshot(
      doc(getDb(), 'support_cases', caseId),
      (snap) => {
        setSupportCase(
          snap.exists()
            ? ({ ...(snap.data() as SupportCase), caseId } as SupportCase)
            : null,
        );
      },
      (err) => setError(err.message),
    );
    const unsubMsg = onSnapshot(
      query(
        collection(getDb(), 'support_messages'),
        where('caseId', '==', caseId),
        orderBy('createdAt', 'asc'),
      ),
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data() as Message;
            return { ...data, messageId: data.messageId ?? d.id };
          }),
        );
        setError(null);
      },
      (err) => setError(err.message),
    );
    return () => {
      unsubCase();
      unsubMsg();
    };
  }, [caseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'postSupportMessage');
      await fn({ caseId, body: body.trim(), visibility: 'PUBLIC' });
      setBody('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: string) {
    setBusy(true);
    setMsg(null);
    try {
      const fn = httpsCallable(
        getFirebaseFunctions(),
        'updateSupportCaseStatus',
      );
      await fn({ caseId, status });
      setMsg(`Status → ${status}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Support chat">
      <div className="chat-toolbar">
        <Link href="/support" className="btn-ghost">
          ← Inbox
        </Link>
        {supportCase?.ownerUid ? (
          <Link
            href={`/customers/${supportCase.ownerUid}`}
            className="btn-ghost"
          >
            Customer profile
          </Link>
        ) : null}
        {supportCase?.bookingId ? (
          <Link
            href={`/bookings/${supportCase.bookingId}`}
            className="btn-ghost"
          >
            Booking
          </Link>
        ) : null}
      </div>

      {error ? <p className="warn-text">{error}</p> : null}
      {msg ? <p className="freshness">{msg}</p> : null}

      {!supportCase ? (
        <p className="empty-state">Case not found.</p>
      ) : (
        <div className="chat-layout">
          <section className="chat-thread panel">
            <header className="chat-thread-head">
              <div>
                <p className="eyebrow">{supportCase.category ?? 'SUPPORT'}</p>
                <h2>{supportCase.subject}</h2>
                <p className="doc-meta">
                  {shortId(caseId, 14)} · {supportCase.priority} · customer{' '}
                  {shortId(supportCase.ownerUid, 8)}
                </p>
              </div>
              <span className="status-pill live">{supportCase.status}</span>
            </header>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <p className="empty-state">No messages yet.</p>
              ) : (
                messages.map((m) => {
                  const mine = m.authorUid === user?.uid;
                  const adminBubble = m.authorRole === 'ADMIN' || mine;
                  return (
                    <div
                      key={m.messageId}
                      className={`chat-bubble${adminBubble ? ' admin' : ' customer'}`}
                    >
                      <div className="chat-bubble-meta">
                        {adminBubble ? 'Ops' : 'Customer'} · {when(m.createdAt)}
                        {m.visibility === 'INTERNAL' ? ' · internal' : ''}
                      </div>
                      <p>{m.body}</p>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form className="chat-composer" onSubmit={send}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a reply to the customer…"
                rows={3}
                disabled={busy}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !body.trim()}
              >
                {busy ? 'Sending…' : 'Send reply'}
              </button>
            </form>
          </section>

          <aside className="chat-side panel">
            <h3>Case controls</h3>
            <div className="chip-row">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${supportCase.status === s ? ' active' : ''}`}
                  disabled={busy}
                  onClick={() => setStatus(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="chat-side-meta">
              <div>
                <span>Customer</span>
                <strong>{shortId(supportCase.ownerUid, 12)}</strong>
              </div>
              <div>
                <span>Booking</span>
                <strong>{shortId(supportCase.bookingId, 12)}</strong>
              </div>
              <div>
                <span>Driver</span>
                <strong>
                  {shortId(String(supportCase.context?.driverId ?? ''), 12)}
                </strong>
              </div>
            </div>
          </aside>
        </div>
      )}
    </AdminShell>
  );
}
