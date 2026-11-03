'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function EventsPage() {
  return (
    <LiveCollectionTable
      title="Events"
      purpose="Special-event overlays that adjust dispatch / pricing when configured."
      collectionName="events"
      orderField="updatedAt"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'marketId', label: 'Market' },
        { key: 'status', label: 'Status' },
        { key: 'startsAt', label: 'Starts' },
        { key: 'endsAt', label: 'Ends' },
      ]}
    />
  );
}
