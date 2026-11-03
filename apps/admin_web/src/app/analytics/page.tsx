'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function AnalyticsPage() {
  return (
    <LiveCollectionTable
      title="Analytics"
      purpose="Daily analytics aggregates and system_health. Seed writes system_health/global."
      collectionName="system_health"
      orderField="updatedAt"
      columns={[
        { key: 'id', label: 'Scope' },
        { key: 'status', label: 'Status' },
        {
          key: 'listenersFresh',
          label: 'Listeners',
          render: (r) => (r.listenersFresh ? 'fresh' : 'stale'),
        },
        { key: 'notice', label: 'Notice' },
        { key: 'updatedAt', label: 'Updated' },
      ]}
    />
  );
}
