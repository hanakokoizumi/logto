import type Tenant from './Tenant.js';
import type TenantContext from './TenantContext.js';

type TenantPoolGet = (tenantId: string, customDomain?: string) => Promise<Tenant>;

// eslint-disable-next-line @silverhand/fp/no-let -- module-level indirection to avoid `routes` ↔ `tenants` import cycle
let getTenant: TenantPoolGet | undefined;

/**
 * Exposes {@link tenantPool.get} to route modules without importing {@link tenantPool} from
 * `./index.js`, which would create a static dependency cycle (`routes` → `tenants` → `Tenant` →
 * `routes/init`).
 */
export const defineTenantPoolGetForRoutes = (getter: TenantPoolGet | undefined): void => {
  // eslint-disable-next-line @silverhand/fp/no-mutation -- setter for the indirection above
  getTenant = getter;
};

/** Hold the acquired tenant's request slot until the route work settles. */
export const withTenantContextForRoutes = async <T>(
  tenantId: string,
  run: (tenant: TenantContext) => Promise<T>,
  customDomain?: string
): Promise<T> => {
  if (!getTenant) {
    throw new Error(
      'Tenant pool getter is not wired; defineTenantPoolGetForRoutes was not called.'
    );
  }

  const tenant = await getTenant(tenantId, customDomain);

  try {
    return await run(tenant);
  } finally {
    tenant.requestEnd();
  }
};
