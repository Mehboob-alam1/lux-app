import { HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import {
  Permission,
  Role,
  RoleSchema,
  anyRoleHasPermission,
  isAdminRole,
} from '@lux/contracts';
import { db } from '../firebase';

export type AuthContext = {
  uid: string;
  roles: Role[];
  marketIds: string[];
  accountState: string;
  token: Record<string, unknown>;
};

function parseRoles(raw: unknown): Role[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => RoleSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => (r as { success: true; data: Role }).data);
}

/**
 * Verify Auth + cross-check users/{uid} role records (claims alone are insufficient
 * for frequently changing access).
 */
export async function requireAuth(
  request: CallableRequest,
): Promise<AuthContext> {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const uid = request.auth.uid;
  const claimRoles = parseRoles(request.auth.token.roles);

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    // Allow first-time bootstrap for customer self-registration path only via dedicated fn
    throw new HttpsError('failed-precondition', 'User profile not provisioned');
  }
  const data = userSnap.data()!;
  if (data.accountState === 'DISABLED' || data.accountState === 'DEACTIVATED') {
    throw new HttpsError('permission-denied', 'Account disabled');
  }
  if (data.accountState === 'SUSPENDED') {
    throw new HttpsError('permission-denied', 'Account suspended');
  }

  const dbRoles = parseRoles(data.roleIds);
  // Intersection preference: only roles present in DB records
  const roles =
    dbRoles.length > 0
      ? dbRoles.filter((r) => claimRoles.includes(r) || dbRoles.includes(r))
      : claimRoles;

  // Prefer DB as source of truth when present
  const effectiveRoles = dbRoles.length > 0 ? dbRoles : roles;

  return {
    uid,
    roles: effectiveRoles,
    marketIds: Array.isArray(data.marketIds) ? data.marketIds : [],
    accountState: String(data.accountState ?? 'ACTIVE'),
    token: request.auth.token as Record<string, unknown>,
  };
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  if (!anyRoleHasPermission(ctx.roles, permission)) {
    throw new HttpsError('permission-denied', `Missing permission ${permission}`);
  }
}

export function requireMarketScope(ctx: AuthContext, marketId: string): void {
  if (ctx.roles.includes('ADMIN_SUPER')) return;
  if (ctx.roles.some(isAdminRole)) {
    if (ctx.marketIds.length > 0 && !ctx.marketIds.includes(marketId)) {
      throw new HttpsError('permission-denied', 'Market out of scope');
    }
  }
}

export function assertAppCheck(request: CallableRequest): void {
  const enforce = process.env.APPCHECK_ENFORCE === 'true';
  if (!enforce) return;
  if (!request.app) {
    throw new HttpsError('failed-precondition', 'App Check required');
  }
}

/** Idempotency: store result hash; replay returns stored response. */
export async function withIdempotency<T>(
  key: string,
  commandName: string,
  uid: string,
  execute: () => Promise<T>,
): Promise<T> {
  const ref = db.collection('idempotency_keys').doc(`${commandName}_${key}`);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data()!;
    if (data.uid !== uid) {
      throw new HttpsError('permission-denied', 'Idempotency key conflict');
    }
    return data.response as T;
  }

  const response = await execute();
  await ref.create({
    uid,
    commandName,
    response,
    createdAt: new Date().toISOString(),
  });
  return response;
}
