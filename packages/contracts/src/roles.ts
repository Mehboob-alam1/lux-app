import { z } from 'zod';

/** Platform roles. Claims are a hint; server always cross-checks active role records. */
export const RoleSchema = z.enum([
  'CUSTOMER',
  'DRIVER',
  'ADMIN_SUPER',
  'ADMIN_OPERATIONS',
  'ADMIN_DISPATCHER',
  'ADMIN_SUPPORT',
  'ADMIN_FINANCE',
  'ADMIN_COMPLIANCE',
  'ADMIN_SAFETY',
  'ADMIN_READ_ONLY',
]);
export type Role = z.infer<typeof RoleSchema>;

export const AccountStateSchema = z.enum([
  'ACTIVE',
  'PENDING',
  'LIMITED',
  'UNDER_REVIEW',
  'SUSPENDED',
  'DEACTIVATED',
  'DISABLED',
]);
export type AccountState = z.infer<typeof AccountStateSchema>;

/** Fine-grained permissions checked server-side. */
export const PermissionSchema = z.enum([
  'booking:read',
  'booking:create',
  'booking:update',
  'booking:cancel',
  'booking:reprice',
  'booking:assign',
  'booking:rescue',
  'quote:create',
  'payment:authorize',
  'payment:capture',
  'payment:refund',
  'payment:adjust',
  'payout:read',
  'payout:settle',
  'payout:adjust',
  'driver:approve',
  'driver:restrict',
  'vehicle:approve',
  'document:review',
  'customer:read',
  'customer:credit',
  'support:read',
  'support:write',
  'dispute:read',
  'dispute:decide',
  'incident:read',
  'incident:write',
  'incident:evidence',
  'pricing:manage',
  'market:manage',
  'analytics:read',
  'audit:read',
  'admin:impersonate_search',
  'system:emergency_pause',
]);
export type Permission = z.infer<typeof PermissionSchema>;

const ALL_ADMIN_READ: Permission[] = [
  'booking:read',
  'customer:read',
  'support:read',
  'dispute:read',
  'incident:read',
  'payout:read',
  'analytics:read',
];

/** Role → permission matrix (least privilege). Market scope applied separately. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: [
    'booking:read',
    'booking:create',
    'booking:cancel',
    'quote:create',
    'payment:authorize',
    'support:write',
  ],
  DRIVER: [
    'booking:read',
    'payout:read',
    'support:write',
    'incident:write',
  ],
  ADMIN_SUPER: [
    ...Object.values(PermissionSchema.enum),
  ],
  ADMIN_OPERATIONS: [
    ...ALL_ADMIN_READ,
    'booking:create',
    'booking:update',
    'booking:cancel',
    'booking:assign',
    'booking:rescue',
    'booking:reprice',
    'driver:restrict',
    'support:write',
    'system:emergency_pause',
    'admin:impersonate_search',
  ],
  ADMIN_DISPATCHER: [
    'booking:read',
    'booking:assign',
    'booking:rescue',
    'booking:update',
    'customer:read',
    'support:write',
    'analytics:read',
    'admin:impersonate_search',
  ],
  ADMIN_SUPPORT: [
    'booking:read',
    'customer:read',
    'support:read',
    'support:write',
    'dispute:read',
    'incident:read',
    'customer:credit',
    'admin:impersonate_search',
  ],
  ADMIN_FINANCE: [
    'booking:read',
    'payment:refund',
    'payment:adjust',
    'payout:read',
    'payout:settle',
    'payout:adjust',
    'customer:credit',
    'dispute:read',
    'analytics:read',
    'audit:read',
  ],
  ADMIN_COMPLIANCE: [
    ...ALL_ADMIN_READ,
    'document:review',
    'driver:approve',
    'vehicle:approve',
    'driver:restrict',
    'audit:read',
  ],
  ADMIN_SAFETY: [
    'booking:read',
    'incident:read',
    'incident:write',
    'incident:evidence',
    'driver:restrict',
    'support:read',
    'audit:read',
  ],
  ADMIN_READ_ONLY: [...ALL_ADMIN_READ, 'audit:read'],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function anyRoleHasPermission(
  roles: readonly Role[],
  permission: Permission,
): boolean {
  return roles.some((r) => roleHasPermission(r, permission));
}

export function isAdminRole(role: Role): boolean {
  return role.startsWith('ADMIN_');
}
