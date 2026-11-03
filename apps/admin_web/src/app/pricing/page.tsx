'use client';

import { LiveCollectionTable } from '@/components/LiveCollectionTable';

export default function PricingPage() {
  return (
    <LiveCollectionTable
      title="Pricing"
      purpose="Demo pricing_rules only — not production commercial rates (D012)."
      collectionName="pricing_rules"
      columns={[
        { key: 'ruleVersion', label: 'Version' },
        { key: 'marketId', label: 'Market' },
        { key: 'currency', label: 'Currency' },
        {
          key: 'baseMinor',
          label: 'Base',
          render: (r) =>
            r.baseMinor != null ? `${Number(r.baseMinor) / 100}` : '—',
        },
        {
          key: 'perKmMinor',
          label: 'Per km',
          render: (r) =>
            r.perKmMinor != null ? `${Number(r.perKmMinor) / 100}` : '—',
        },
        { key: 'notice', label: 'Notice' },
      ]}
    />
  );
}
