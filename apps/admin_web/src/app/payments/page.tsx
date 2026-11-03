'use client';

import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AdminShell } from '@/components/AdminShell';
import { getDb, getFirebaseFunctions } from '@/lib/firebase';

export default function PaymentsPage() {
  const [rows, setRows] = useState<
    {
      paymentId?: string;
      state?: string;
      amountMinor?: number;
      currency?: string;
      bookingId?: string;
      paymentMode?: string;
    }[]
  >([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(collection(getDb(), 'payments'), orderBy('createdAt', 'desc'), limit(40)),
      (s) => setRows(s.docs.map((d) => d.data() as (typeof rows)[0])),
      () => undefined,
    );
  }, []);

  async function refund(paymentId: string, amountMinor: number) {
    setMsg('Refunding…');
    try {
      const fn = httpsCallable(getFirebaseFunctions(), 'refundPayment');
      await fn({
        paymentId,
        amountMinor,
        reason: 'Admin partial/full refund',
        idempotencyKey: `refund_${paymentId}_${Date.now()}`,
        marketId: 'yyz',
      });
      setMsg('Refund recorded');
    } catch (e) {
      setMsg(String(e));
    }
  }

  return (
    <AdminShell title="Payments">
      <p className="page-lede">
        Sandbox by default. Live Stripe requires credentials — never client-set
        success.
      </p>
      {msg ? <p className="freshness">{msg}</p> : null}
      {rows.length === 0 ? (
        <p className="empty-state">No payments yet.</p>
      ) : (
        <div className="table-shell">
          <table className="lux-table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>State</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={i}>
                  <td>
                    <strong>{p.paymentId}</strong>
                    {p.bookingId ? (
                      <div style={{ color: 'var(--lux-muted)', fontSize: '0.8rem' }}>
                        {p.bookingId}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={`status-pill ${p.state === 'CAPTURED' || p.state === 'AUTHORIZED' ? 'ok' : 'warn'}`}
                    >
                      {p.state}
                    </span>
                  </td>
                  <td>
                    {((p.amountMinor ?? 0) / 100).toFixed(2)} {p.currency}
                  </td>
                  <td>{p.paymentMode}</td>
                  <td>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => refund(p.paymentId!, p.amountMinor ?? 0)}
                    >
                      Refund
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
