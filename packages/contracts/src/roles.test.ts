import { describe, expect, it } from 'vitest';
import { anyRoleHasPermission, roleHasPermission } from './roles';

describe('RBAC matrix', () => {
  it('denies finance refund to dispatcher', () => {
    expect(roleHasPermission('ADMIN_DISPATCHER', 'payment:refund')).toBe(false);
  });

  it('allows finance refund', () => {
    expect(roleHasPermission('ADMIN_FINANCE', 'payment:refund')).toBe(true);
  });

  it('allows super all sensitive', () => {
    expect(roleHasPermission('ADMIN_SUPER', 'system:emergency_pause')).toBe(
      true,
    );
  });

  it('customers cannot assign', () => {
    expect(anyRoleHasPermission(['CUSTOMER'], 'booking:assign')).toBe(false);
  });
});
