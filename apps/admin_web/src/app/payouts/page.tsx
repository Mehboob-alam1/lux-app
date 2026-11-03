'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function PayoutsPage() {
  return (
    <LiveCollectionTable
      title="Payouts"
      purpose="Driver payout ledger rows written by trip completion / payment capture."
      collectionName="payout_ledger"
      orderField="updatedAt"
      columns={[
        { key: 'id', label: 'ID' },
        { key: 'driverId', label: 'Driver' },
        { key: 'bookingId', label: 'Booking' },
        { key: 'status', label: 'Status' },
        {
          key: 'amountMinor',
          label: 'Amount',
          render: (r) =>
            r.amountMinor != null
              ? `${Number(r.amountMinor) / 100} ${r.currency ?? ''}`
              : '—',
        },
        { key: 'updatedAt', label: 'Updated' },
      ]}
    />
  );
}
