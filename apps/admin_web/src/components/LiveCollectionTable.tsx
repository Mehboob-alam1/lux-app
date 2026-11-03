'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryConstraint,
} from 'firebase/firestore';
import { AdminShell } from './AdminShell';
import { getDb } from '@/lib/firebase';

type Column = {
  key: string;
  label: string;
  render?: (row: Record<string, unknown>) => React.ReactNode;
};

export function LiveCollectionTable({
  title,
  purpose,
  collectionName,
  columns,
  orderField,
  pageSize = 50,
}: {
  title: string;
  purpose: string;
  collectionName: string;
  columns: Column[];
  orderField?: string;
  pageSize?: number;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [freshAt, setFreshAt] = useState<string | null>(null);

  useEffect(() => {
    const constraints: QueryConstraint[] = [];
    if (orderField) constraints.push(orderBy(orderField, 'desc'));
    constraints.push(limit(pageSize));
    return onSnapshot(
      query(collection(getDb(), collectionName), ...constraints),
      (snap) => {
        setRows(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return { id: d.id, ...data };
          }),
        );
        setFreshAt(new Date().toISOString());
        setError(null);
      },
      (err) => {
        setError(err.message);
        setFreshAt(null);
      },
    );
  }, [collectionName, orderField, pageSize]);

  return (
    <AdminShell title={title}>
      <p className="page-lede">{purpose}</p>
      <p className={`freshness${freshAt ? '' : ' warn'}`} role="status">
        {freshAt
          ? `Data fresh at ${freshAt}`
          : 'Data freshness warning: listener not connected'}
      </p>
      {error ? <p className="warn-text">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <p className="empty-state">
          No documents in <code>{collectionName}</code> yet — empty is empty,
          not mock data.
        </p>
      ) : (
        <div className="table-shell">
          <table className="lux-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
