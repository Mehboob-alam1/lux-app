import { AdminShell } from './AdminShell';

export function ModulePage({
  title,
  purpose,
  children,
}: {
  title: string;
  purpose: string;
  children?: React.ReactNode;
}) {
  return (
    <AdminShell title={title}>
      <p className="page-lede">{purpose}</p>
      {children ?? (
        <div className="panel">
          <p className="empty-state" style={{ paddingTop: 0, paddingBottom: 0 }}>
            Wired to Firebase collections via Cloud Functions. Lists stay empty
            until emulator seed data is loaded — no fabricated rows.
          </p>
        </div>
      )}
    </AdminShell>
  );
}
