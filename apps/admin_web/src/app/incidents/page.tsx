'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function IncidentsPage() {
  return (
    <LiveCollectionTable
      title="Incidents & Safety"
      purpose="Safety escalations and incidents created via createSupportCase escalateSafety."
      collectionName="incidents"
      orderField="updatedAt"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'status', label: 'Status' },
        { key: 'category', label: 'Category' },
        { key: 'bookingId', label: 'Booking' },
        { key: 'updatedAt', label: 'Updated' },
      ]}
    />
  );
}
