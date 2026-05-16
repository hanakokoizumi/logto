import { type UserWithOrganizationRoles } from '@logto/schemas';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactModal from 'react-modal';
import useSWR from 'swr';

import Plus from '@/assets/icons/plus.svg?react';
import ActionsButton from '@/components/ActionsButton';
import EmptyDataPlaceholder from '@/components/EmptyDataPlaceholder';
import UserPreview from '@/components/ItemPreview/UserPreview';
import { RoleOption } from '@/components/OrganizationRolesSelect';
import { defaultPageSize } from '@/consts';
import Button from '@/ds-components/Button';
import DynamicT from '@/ds-components/DynamicT';
import FormField from '@/ds-components/FormField';
import ModalLayout from '@/ds-components/ModalLayout';
import Table from '@/ds-components/Table';
import Tag from '@/ds-components/Tag';
import TextInput from '@/ds-components/TextInput';
import useApi, { RequestError } from '@/hooks/use-api';
import useCurrentUser from '@/hooks/use-current-user';
import modalStyles from '@/scss/modal.module.scss';
import { trySubmitSafe } from '@/utils/form';
import { buildUrl } from '@/utils/url';

import styles from './index.module.scss';

const pageSize = defaultPageSize;

const getConsoleOperatorsListErrorMessage = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof RequestError) {
    const parts = [value.body?.message, value.body?.details].filter(
      (part): part is string => typeof part === 'string' && part.length > 0
    );

    return parts.length > 0 ? parts.join('\n') : undefined;
  }

  if (value instanceof Error) {
    return value.message;
  }

  return undefined;
};

type CreateConsoleOperatorForm = {
  primaryEmail: string;
  password: string;
  username: string;
  name: string;
};

function Members() {
  const { t } = useTranslation(undefined, { keyPrefix: 'admin_console' });
  const api = useApi();
  const { user: currentUser } = useCurrentUser();
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const listKey = buildUrl('api/console-operators', {
    page: String(page),
    page_size: String(pageSize),
  });

  const {
    data: response,
    error,
    mutate,
  } = useSWR<[UserWithOrganizationRoles[], number], RequestError>(listKey);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CreateConsoleOperatorForm>({
    defaultValues: {
      primaryEmail: '',
      password: '',
      username: '',
      name: '',
    },
  });

  const [data, totalCount = 0] = response ?? [];
  const isLoading = !response && !error;

  useEffect(() => {
    if (isCreateModalOpen) {
      reset();
    }
  }, [isCreateModalOpen, reset]);

  const onCreateSubmit = handleSubmit(
    trySubmitSafe(async (formData) => {
      const trimmedUsername = formData.username.trim();
      const trimmedName = formData.name.trim();

      await api.post('api/console-operators', {
        json: {
          primaryEmail: formData.primaryEmail.trim(),
          password: formData.password,
          ...(trimmedUsername ? { username: trimmedUsername } : {}),
          ...(trimmedName ? { name: trimmedName } : {}),
        },
      });

      toast.success(t('tenants.members.console_operators.created_success'));
      setIsCreateModalOpen(false);
      reset();
      await mutate();
    })
  );

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.intro}>
          <DynamicT forKey="tenants.members.console_operators.description" />
        </div>
        <Button
          type="primary"
          size="large"
          icon={<Plus />}
          title="tenants.members.console_operators.create_button"
          onClick={() => {
            setIsCreateModalOpen(true);
          }}
        />
      </div>
      <Table
        isRowHoverEffectDisabled
        placeholder={<EmptyDataPlaceholder title={t('tenants.members.console_operators.empty')} />}
        pagination={{
          page,
          totalCount,
          pageSize,
          onChange: setPage,
        }}
        isLoading={isLoading}
        errorMessage={getConsoleOperatorsListErrorMessage(error)}
        rowGroups={[{ key: 'operators', data }]}
        columns={[
          {
            dataIndex: 'user',
            title: t('tenants.members.console_operators.table_user'),
            colSpan: 10,
            render: (row) => <UserPreview user={row} />,
          },
          {
            dataIndex: 'roles',
            title: t('tenants.members.console_operators.table_roles'),
            colSpan: 8,
            render: ({ organizationRoles }) => {
              if (organizationRoles.length === 0) {
                return '-';
              }

              return (
                <div className={styles.roles}>
                  {organizationRoles.map(({ id, name }) => (
                    <Tag key={id} variant="cell">
                      <RoleOption value={id} title={name} />
                    </Tag>
                  ))}
                </div>
              );
            },
          },
          {
            dataIndex: 'actions',
            title: null,
            colSpan: 2,
            render: (row) =>
              row.id === currentUser?.id ? null : (
                <ActionsButton
                  deleteConfirmation="tenants.members.console_operators.delete_description"
                  fieldName="tenants.members.console_operators.table_user"
                  textOverrides={{
                    delete: 'tenants.members.console_operators.delete_action',
                    deleteConfirmation: 'general.remove',
                  }}
                  onDelete={async () => {
                    await api.delete(`api/console-operators/${row.id}`);
                    toast.success(t('tenants.members.console_operators.deleted_success'));
                    await mutate();
                  }}
                />
              ),
          },
        ]}
        rowIndexKey="id"
      />

      <ReactModal
        shouldCloseOnEsc
        isOpen={isCreateModalOpen}
        className={modalStyles.content}
        overlayClassName={modalStyles.overlay}
        onRequestClose={() => {
          setIsCreateModalOpen(false);
        }}
      >
        <ModalLayout
          title="tenants.members.console_operators.modal_title"
          footer={
            <>
              <Button
                title="general.cancel"
                onClick={() => {
                  setIsCreateModalOpen(false);
                }}
              />
              <Button
                isLoading={isSubmitting}
                htmlType="submit"
                type="primary"
                title="tenants.members.console_operators.create_submit"
                onClick={() => {
                  void onCreateSubmit();
                }}
              />
            </>
          }
          onClose={() => {
            setIsCreateModalOpen(false);
          }}
        >
          <form>
            <FormField isRequired title="tenants.members.console_operators.field_primary_email">
              <Controller
                name="primaryEmail"
                control={control}
                rules={{ required: true }}
                render={({ field }) => <TextInput {...field} />}
              />
            </FormField>
            <FormField isRequired title="tenants.members.console_operators.field_password">
              <Controller
                name="password"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <TextInput {...field} type="password" autoComplete="new-password" />
                )}
              />
            </FormField>
            <FormField title="tenants.members.console_operators.field_username">
              <Controller
                name="username"
                control={control}
                render={({ field }) => <TextInput {...field} />}
              />
            </FormField>
            <FormField title="tenants.members.console_operators.field_name">
              <Controller
                name="name"
                control={control}
                render={({ field }) => <TextInput {...field} />}
              />
            </FormField>
          </form>
        </ModalLayout>
      </ReactModal>
    </div>
  );
}

export default Members;
