'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function DocumentsPage() {
  return (
    <LiveCollectionTable
      title="Documents"
      purpose="Eligibility and document records. Empty until drivers upload / jobs write."
      collectionName="eligibility_records"
      orderField="updatedAt"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'entityType', label: 'Entity' },
        { key: 'entityId', label: 'Entity ID' },
        { key: 'status', label: 'Status' },
        { key: 'updatedAt', label: 'Updated' },
      ]}
    />
  );
}
