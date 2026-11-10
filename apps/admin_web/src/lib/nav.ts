export type NavItem = {
  href: string;
  label: string;
  icon: string;
  disabled?: boolean;
  badge?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: '◆' },
  { href: '/live', label: 'Live Ops', icon: '◎' },
  { href: '/bookings', label: 'Bookings', icon: '▣' },
  { href: '/assignment', label: 'Assign', icon: '➔' },
  { href: '/customers', label: 'Customers', icon: '◯' },
  { href: '/drivers', label: 'Drivers', icon: '▴' },
  { href: '/vehicles', label: 'Vehicles', icon: '▦' },
  { href: '/documents', label: 'Documents', icon: '▤' },
  { href: '/airports', label: 'Airports', icon: '▲' },
  { href: '/events', label: 'Events', icon: '◇' },
  { href: '/pricing', label: 'Pricing', icon: '≡' },
  { href: '/payments', label: 'Payments', icon: '☰' },
  { href: '/payouts', label: 'Payouts', icon: '↓' },
  { href: '/support', label: 'Support', icon: '?' },
  { href: '/disputes', label: 'Disputes', icon: '✖' },
  { href: '/incidents', label: 'Safety', icon: '!' },
  { href: '/analytics', label: 'Analytics', icon: '▦' },
  { href: '/markets', label: 'Markets', icon: '○' },
  {
    href: '/fleets',
    label: 'Fleets',
    icon: '▮',
    disabled: true,
    badge: 'Soon',
  },
  {
    href: '/agencies',
    label: 'Agencies',
    icon: '⌂',
    disabled: true,
    badge: 'Soon',
  },
];
