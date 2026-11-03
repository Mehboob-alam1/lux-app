'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function CustomersPage() {
  return (
    <LiveCollectionTable
      title="Customers"
      purpose="Live customer_profiles from Firestore. Family members and credits appear when seeded or created via callables."
      collectionName="customer_profiles"
      orderField="updatedAt"
      columns={[
        { key: 'displayName', label: 'Name' },
        { key: 'uid', label: 'UID' },
        {
          key: 'notificationSettings',
          label: 'Notify',
          render: (r) => {
            const n = r.notificationSettings as
              | Record<string, boolean>
              | undefined;
            if (!n) return '—';
            return [
              n.push ? 'push' : null,
              n.email ? 'email' : null,
              n.sms ? 'sms' : null,
            ]
              .filter(Boolean)
              .join(', ') || '—';
          },
        },
        { key: 'updatedAt', label: 'Updated' },
      ]}
    />
  );
}
