'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function AirportsPage() {
  return (
    <LiveCollectionTable
      title="Airports"
      purpose="Market airport configs used for AIRPORT trip context and meet-and-greet."
      collectionName="airports"
      columns={[
        { key: 'airportId', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'marketId', label: 'Market' },
        {
          key: 'terminals',
          label: 'Terminals',
          render: (r) =>
            Array.isArray(r.terminals) ? r.terminals.join(', ') : '—',
        },
      ]}
    />
  );
}
