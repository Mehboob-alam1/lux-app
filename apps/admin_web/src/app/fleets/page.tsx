import { AdminShell } from '@/components/AdminShell';

export default function FleetsPlaceholderPage() {
  return (
    <AdminShell title="Fleets">
      <div
        role="status"
        style={{
          border: '1px dashed var(--lux-gold-dim)',
          borderRadius: 10,
          padding: '1.5rem',
          maxWidth: 480,
        }}
      >
        <p style={{ marginTop: 0, color: 'var(--lux-gold)' }}>
          Coming in next update
        </p>
        <p style={{ color: 'var(--lux-muted)', marginBottom: 0 }}>
          Fleet company operations are intentionally not implemented in this
          release. This route is a nonfunctional placeholder only.
        </p>
      </div>
    </AdminShell>
  );
}
