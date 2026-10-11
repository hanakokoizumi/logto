import { adminTenantId, defaultTenantId, type UserWithOrganizationRoles } from '@logto/schemas';

import { koaManagementApiHooks } from '#src/middleware/koa-management-api-hooks.js';
import type Tenant from '#src/tenants/Tenant.js';
import { tenantPool } from '#src/tenants/index.js';
import { defineTenantPoolGetForRoutes } from '#src/tenants/tenant-pool-for-routes.js';
import { MockTenant } from '#src/test-utils/tenant.js';
import { createRequester } from '#src/utils/test-utils.js';

import consoleOperatorsRoutes from './index.js';

const { jest } = import.meta;

class DefaultTenantMockContext extends MockTenant {
  public override id = defaultTenantId;
}

describe('consoleOperatorsRoutes', () => {
  // eslint-disable-next-line @silverhand/fp/no-let -- Jest spy is reassigned in `beforeEach`
  let tenantPoolGetSpy: jest.SpiedFunction<
    (tenantId: string, customDomain?: string) => Promise<Tenant>
  >;

  const defaultTenantContext = new DefaultTenantMockContext();

  const request = createRequester({
    middlewares: [koaManagementApiHooks(defaultTenantContext.libraries.hooks)],
    authedRoutes: consoleOperatorsRoutes,
    tenantContext: defaultTenantContext,
  });

  beforeEach(() => {
    defineTenantPoolGetForRoutes(async (tenantId, customDomain) =>
      tenantPool.get(tenantId, customDomain)
    );
    // eslint-disable-next-line @silverhand/fp/no-mutation -- Jest `spyOn` assignment
    tenantPoolGetSpy = jest.spyOn(tenantPool, 'get');
  });

  afterEach(() => {
    tenantPoolGetSpy.mockRestore();
  });

  it('DELETE /console-operators/:userId rejects deleting self before touching tenant pool', async () => {
    const response = await request.delete('/console-operators/foo');

    expect(tenantPoolGetSpy).not.toHaveBeenCalled();
    expect(response.status).toEqual(400);
  });

  it('uses the admin tenant username policy when checking a duplicate operator', async () => {
    const requestEnd = jest.fn();
    const hasUser = jest.fn(async () => true);
    const getUsernameCaseSensitive = jest.fn(async () => false);

    tenantPoolGetSpy.mockResolvedValue({
      requestEnd,
      queries: {
        users: {
          hasUser,
          hasUserWithEmail: jest.fn(async () => false),
        },
        signInExperiences: { getUsernameCaseSensitive },
      },
      libraries: { users: {} },
    } as unknown as Tenant);

    const response = await request.post('/console-operators').send({
      username: '123operator',
      primaryEmail: 'operator@example.com',
      password: 'OperatorPassword1!',
    });

    expect(response.status).toEqual(422);
    expect(hasUser).toHaveBeenCalledWith('123operator', false);
    expect(requestEnd).toHaveBeenCalledTimes(1);
  });

  it('GET /console-operators returns operators from admin tenant organization', async () => {
    const requestEnd = jest.fn();
    const listRow: UserWithOrganizationRoles = {
      id: 'op1',
      username: 'opuser',
      primaryEmail: 'op@example.com',
      primaryPhone: null,
      name: null,
      avatar: null,
      customData: {},
      identities: {},
      lastSignInAt: null,
      createdAt: 1,
      updatedAt: 1,
      profile: {},
      applicationId: null,
      cimdClientId: null,
      isSuspended: false,
      organizationRoles: [{ id: 'role1', name: 'Admin' }],
    };

    tenantPoolGetSpy.mockResolvedValue({
      requestEnd,
      queries: {
        organizations: {
          relations: {
            users: {
              getUsersByOrganizationId: jest.fn(async () => [1, [listRow]]),
            },
          },
        },
      },
    } as unknown as Tenant);

    const response = await request.get('/console-operators?page=1&page_size=20');

    expect(tenantPoolGetSpy).toHaveBeenCalledWith(adminTenantId, undefined);
    expect(response.status).toEqual(200);
    expect(response.body).toEqual([listRow]);
    expect(response.headers['total-number']).toEqual('1');
    expect(requestEnd).toHaveBeenCalledTimes(1);
  });

  it('releases the admin tenant when listing operators fails', async () => {
    const requestEnd = jest.fn();
    tenantPoolGetSpy.mockResolvedValue({
      requestEnd,
      queries: {
        organizations: {
          relations: {
            users: {
              getUsersByOrganizationId: jest.fn(async () => {
                throw new Error('Database unavailable');
              }),
            },
          },
        },
      },
    } as unknown as Tenant);

    const response = await request.get('/console-operators');

    expect(response.status).toEqual(500);
    expect(requestEnd).toHaveBeenCalledTimes(1);
  });
});
