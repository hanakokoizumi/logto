import type TenantContext from './TenantContext.js';

type TenantPoolGet = (tenantId: string, customDomain?: string) => Promise<TenantContext>;

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

export const getTenantContextForRoutes = async (
  tenantId: string,
  customDomain?: string
): Promise<TenantContext> => {
  if (!getTenant) {
    throw new Error(
      'Tenant pool getter is not wired; defineTenantPoolGetForRoutes was not called.'
    );
  }

  return getTenant(tenantId, customDomain);
};
