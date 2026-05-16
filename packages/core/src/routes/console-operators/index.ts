/**
 * OSS-only: Management API routes on the **default** tenant that proxy console operator
 * lifecycle to the **admin** tenant (insert user, roles, default-tenant organization membership).
 *
 * @remarks
 * The Console OSS client only obtains tokens for the default-tenant Management API audience;
 * it cannot call admin-tenant `/api/users` directly. These routes run under default-tenant MAPI
 * auth but mutate the admin-tenant database via {@link getTenantContextForRoutes} (see
 * {@link defineTenantPoolGetForRoutes}).
 */
import { emailRegEx, usernameRegEx } from '@logto/core-kit';
import {
  AdminTenantRole,
  OrganizationUserRelations,
  ProductEvent,
  adminTenantId,
  defaultManagementApiAdminName,
  defaultTenantId,
  getTenantOrganizationId,
  getTenantRole,
  TenantRole,
  userMfaDataKey,
  userWithOrganizationRolesGuard,
} from '@logto/schemas';
import { sql } from '@silverhand/slonik';
import { object, string } from 'zod';

import { EnvSet } from '#src/env-set/index.js';
import RequestError from '#src/errors/RequestError/index.js';
import { buildManagementApiContext } from '#src/libraries/hook/utils.js';
import { encryptUserPassword } from '#src/libraries/user.utils.js';
import koaGuard from '#src/middleware/koa-guard.js';
import koaPagination from '#src/middleware/koa-pagination.js';
import { getTenantContextForRoutes } from '#src/tenants/tenant-pool-for-routes.js';
import assertThat from '#src/utils/assert-that.js';
import { captureDeveloperEvent } from '#src/utils/posthog.js';
import { convertToIdentifiers } from '#src/utils/sql.js';
import {
  adminUserProfileResponseGuard,
  transpileAdminUserProfileResponse,
} from '#src/utils/user.js';

import type { ManagementApiRouter, RouterInitArgs } from '../types.js';

export default function consoleOperatorsRoutes<T extends ManagementApiRouter>(
  ...args: RouterInitArgs<T>
) {
  const [router, { id: requestTenantId }] = args;

  if (EnvSet.values.isCloud || requestTenantId !== defaultTenantId) {
    return;
  }

  router.get(
    '/console-operators',
    koaPagination(),
    koaGuard({
      response: userWithOrganizationRolesGuard.array(),
      status: [200],
    }),
    async (ctx, next) => {
      const adminTenant = await getTenantContextForRoutes(adminTenantId);
      const organizationId = getTenantOrganizationId(defaultTenantId);

      const [totalCount, entities] =
        await adminTenant.queries.organizations.relations.users.getUsersByOrganizationId(
          organizationId,
          ctx.pagination
        );

      ctx.pagination.totalCount = totalCount;
      ctx.body = entities;

      return next();
    }
  );

  router.post(
    '/console-operators',
    koaGuard({
      body: object({
        primaryEmail: string().regex(emailRegEx),
        password: string().min(1),
        username: string().regex(usernameRegEx).optional(),
        name: string().optional(),
      }),
      response: adminUserProfileResponseGuard,
      status: [201, 400, 422],
    }),
    async (ctx, next) => {
      const {
        body: { primaryEmail, password, username, name },
      } = ctx.guard;

      const adminTenant = await getTenantContextForRoutes(adminTenantId);
      const {
        users: { hasUser, hasUserWithEmail },
      } = adminTenant.queries;
      const {
        users: { generateUserId, insertUser },
      } = adminTenant.libraries;

      assertThat(
        !(await hasUserWithEmail(primaryEmail)),
        new RequestError({
          code: 'user.email_already_in_use',
          status: 422,
        })
      );
      assertThat(
        !username || !(await hasUser(username)),
        new RequestError({
          code: 'user.username_already_in_use',
          status: 422,
        })
      );

      const id = await generateUserId();
      const passwordPayload = await encryptUserPassword(password);

      const [user] = await insertUser(
        {
          id,
          primaryEmail,
          username,
          name,
          logtoConfig: {
            [userMfaDataKey]: { enabled: false },
          },
          ...passwordPayload,
        },
        {
          roleNames: [AdminTenantRole.User, defaultManagementApiAdminName],
          isInteractive: true,
        }
      );

      const organizationId = getTenantOrganizationId(defaultTenantId);
      const {
        organizations: { relations },
      } = adminTenant.queries;

      await relations.users.insert({ organizationId, userId: user.id });
      await relations.usersRoles.insert({
        organizationId,
        userId: user.id,
        organizationRoleId: getTenantRole(TenantRole.Admin).id,
      });

      ctx.appendDataHookContext('User.Created', { user });
      ctx.status = 201;
      ctx.body = transpileAdminUserProfileResponse(user);

      return next();
    }
  );

  router.delete(
    '/console-operators/:userId',
    koaGuard({
      params: object({ userId: string() }),
      status: [204, 400, 404, 422],
    }),
    async (ctx, next) => {
      const {
        params: { userId },
      } = ctx.guard;

      if (userId === ctx.auth.id) {
        throw new RequestError('user.cannot_delete_self');
      }

      const adminTenant = await getTenantContextForRoutes(adminTenantId);
      const organizationId = getTenantOrganizationId(defaultTenantId);
      const relationsTable = convertToIdentifiers(OrganizationUserRelations, true);

      const inOrganization = await adminTenant.queries.pool.exists(sql`
        select 1
        from ${relationsTable.table}
        where ${relationsTable.fields.organizationId} = ${organizationId}
        and ${relationsTable.fields.userId} = ${userId}
      `);

      assertThat(inOrganization, new RequestError({ code: 'entity.not_found', status: 404 }));

      const [operatorCount] =
        await adminTenant.queries.organizations.relations.users.getUsersByOrganizationId(
          organizationId,
          { limit: 1, offset: 0 }
        );

      assertThat(
        operatorCount > 1,
        new RequestError({
          code: 'user.console_operator_last_one',
          status: 422,
        })
      );

      const {
        users: { findUserById, deleteUserById },
      } = adminTenant.queries;
      const {
        users: { signOutUser },
      } = adminTenant.libraries;

      const user = await findUserById(userId);

      await signOutUser(userId);
      await deleteUserById(userId);

      captureDeveloperEvent(userId, ProductEvent.DeveloperDeleted);

      ctx.appendDataHookContext('User.Deleted', {
        ...buildManagementApiContext(ctx),
        user,
      });
      ctx.status = 204;

      return next();
    }
  );
}
