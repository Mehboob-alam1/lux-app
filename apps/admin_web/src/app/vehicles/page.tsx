'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function VehiclesPage() {
  return (
    <LiveCollectionTable
      title="Vehicles"
      purpose="Inventory, class eligibility, inspection, and approval from the vehicles collection."
      collectionName="vehicles"
      orderField="updatedAt"
      columns={[
        {
          key: 'vehicle',
          label: 'Vehicle',
          render: (r) =>
            `${r.make ?? ''} ${r.model ?? ''}`.trim() || String(r.vehicleId ?? r.id),
        },
        { key: 'plate', label: 'Plate' },
        {
          key: 'classIds',
          label: 'Classes',
          render: (r) =>
            Array.isArray(r.classIds) ? r.classIds.join(', ') : '—',
        },
        { key: 'status', label: 'Status' },
        { key: 'inspectionStatus', label: 'Inspection' },
        {
          key: 'documentEligibilityOk',
          label: 'Docs OK',
          render: (r) => (r.documentEligibilityOk ? 'yes' : 'no'),
        },
      ]}
    />
  );
}
