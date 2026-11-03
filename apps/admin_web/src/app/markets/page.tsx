'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function MarketsPage() {
  return (
    <LiveCollectionTable
      title="Markets & Settings"
      purpose="Market flags including bookingPaused for emergency pause (runbook)."
      collectionName="markets"
      orderField="updatedAt"
      columns={[
        { key: 'marketId', label: 'ID' },
        { key: 'displayName', label: 'Name' },
        { key: 'timezone', label: 'TZ' },
        { key: 'currency', label: 'Currency' },
        {
          key: 'active',
          label: 'Active',
          render: (r) => (r.active ? 'yes' : 'no'),
        },
        {
          key: 'bookingPaused',
          label: 'Paused',
          render: (r) => (r.bookingPaused ? 'PAUSED' : 'open'),
        },
      ]}
    />
  );
}
