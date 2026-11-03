export type NavItem = {
  href: string;
  label: string;
  disabled?: boolean;
  badge?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/live', label: 'Live Operations' },
  { href: '/bookings', label: 'Bookings' },
  { href: '/assignment', label: 'Assignment & Rescue' },
  { href: '/customers', label: 'Customers' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/airports', label: 'Airports' },
  { href: '/events', label: 'Events' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/payments', label: 'Payments' },
  { href: '/payouts', label: 'Payouts' },
  { href: '/support', label: 'Help & Support' },
  { href: '/disputes', label: 'Disputes' },
  { href: '/incidents', label: 'Incidents & Safety' },
  { href: '/documents', label: 'Documents' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/markets', label: 'Markets & Settings' },
  {
    href: '/fleets',
    label: 'Fleets',
    disabled: true,
    badge: 'Coming in next update',
  },
  {
    href: '/agencies',
    label: 'Agencies',
    disabled: true,
    badge: 'Coming in next update',
  },
];
