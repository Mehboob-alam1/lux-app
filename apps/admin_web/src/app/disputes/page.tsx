'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function DisputesPage() {
  return (
    <LiveCollectionTable
      title="Disputes"
      purpose="Disputes converted from support cases via convertSupportToDispute."
      collectionName="disputes"
      orderField="updatedAt"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'status', label: 'Status' },
        { key: 'supportCaseId', label: 'Case' },
        { key: 'bookingId', label: 'Booking' },
        { key: 'updatedAt', label: 'Updated' },
      ]}
    />
  );
}
