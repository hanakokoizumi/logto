import { AccountCenterControlValue } from '@logto/schemas';
import { formatToInternationalPhoneNumber } from '@logto/shared/universal';
import classNames from 'classnames';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import PageContext from '@ac/Providers/PageContextProvider/PageContext';
import { deletePrimaryPhone } from '@ac/apis/account';
import EmailIcon from '@ac/assets/icons/email.svg?react';
import PhoneIcon from '@ac/assets/icons/phone.svg?react';
import ConfirmModal from '@ac/components/ConfirmModal';
import { layoutClassNames } from '@ac/constants/layout';
import { emailRoute, phoneRoute, verifiedActionRoute } from '@ac/constants/routes';
import useApi from '@ac/hooks/use-api';
import useErrorHandler from '@ac/hooks/use-error-handler';
import { getPendingReturn, setPendingReturn } from '@ac/utils/account-center-route';
import { sessionStorage } from '@ac/utils/session-storage';

import styles from './index.module.scss';

const EmailPhoneSection = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    userInfo,
    accountCenterSettings,
    verificationId,
    setVerificationId,
    refreshUserInfo,
    setToast,
  } = useContext(PageContext);
  const handleError = useErrorHandler();
  const deletePrimaryPhoneApi = useApi(deletePrimaryPhone);

  const [pendingRemovePhone, setPendingRemovePhone] = useState(false);

  const emailControl = accountCenterSettings?.fields.email;
  const phoneControl = accountCenterSettings?.fields.phone;

  const showEmail = emailControl && emailControl !== AccountCenterControlValue.Off;
  const showPhone = phoneControl && phoneControl !== AccountCenterControlValue.Off;
  const emailValue = userInfo?.primaryEmail;
  const phoneValue = userInfo?.primaryPhone
    ? formatToInternationalPhoneNumber(userInfo.primaryPhone)
    : undefined;

  const navigateTo = useCallback(
    (route: string) => {
      setPendingReturn(getPendingReturn() ?? window.location.href);
      navigate(route);
    },
    [navigate]
  );

  const removePhone = useCallback(
    async (verifiedId: string) => {
      const [error] = await deletePrimaryPhoneApi(verifiedId);

      if (error) {
        await handleError(error, {
          'verification_record.permission_denied': async () => {
            setVerificationId(undefined);
            setToast(t('account_center.verification.verification_required'));
          },
        });
        return;
      }

      await refreshUserInfo();
      setToast(t('account_center.security.phone_removed'));
    },
    [deletePrimaryPhoneApi, handleError, refreshUserInfo, setToast, setVerificationId, t]
  );

  const handleRemoveConfirm = useCallback(async () => {
    if (!pendingRemovePhone) {
      return;
    }

    setPendingRemovePhone(false);

    if (verificationId) {
      await removePhone(verificationId);
      return;
    }

    sessionStorage.setPendingVerifiedAction('remove-phone');
    navigateTo(verifiedActionRoute);
  }, [pendingRemovePhone, verificationId, navigateTo, removePhone]);

  useEffect(() => {
    if (!verificationId) {
      return;
    }

    if (sessionStorage.getPendingVerifiedAction() !== 'remove-phone') {
      return;
    }

    sessionStorage.clearPendingVerifiedAction();
    void removePhone(verificationId);
  }, [removePhone, verificationId]);

  if (!showEmail && !showPhone) {
    return null;
  }

  return (
    <>
      <div className={classNames(styles.section, layoutClassNames.section)}>
        <div className={classNames(styles.sectionTitle, layoutClassNames.sectionTitle)}>
          {t('account_center.security.email')}
        </div>
        <div className={classNames(styles.card, layoutClassNames.card)}>
          {showEmail && (
            <div className={classNames(styles.row, layoutClassNames.row)}>
              <div className={styles.topLine}>
                <div className={styles.iconWrap}>
                  <EmailIcon className={styles.icon} />
                </div>
                {emailControl === AccountCenterControlValue.Edit && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.changeButton}
                      onClick={() => {
                        navigateTo(emailRoute);
                      }}
                    >
                      {emailValue
                        ? t('account_center.security.change')
                        : t('account_center.security.add')}
                    </button>
                  </div>
                )}
              </div>
              <div className={styles.title}>{t('account_center.security.email')}</div>
              <div className={classNames(styles.value, !emailValue && styles.secondaryValue)}>
                {emailValue ?? t('account_center.security.not_set')}
              </div>
            </div>
          )}
          {showPhone && (
            <div className={classNames(styles.row, layoutClassNames.row)}>
              <div className={styles.topLine}>
                <div className={styles.iconWrap}>
                  <PhoneIcon className={styles.icon} />
                </div>
                {phoneControl === AccountCenterControlValue.Edit && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.changeButton}
                      onClick={() => {
                        navigateTo(phoneRoute);
                      }}
                    >
                      {phoneValue
                        ? t('account_center.security.change')
                        : t('account_center.security.add')}
                    </button>
                    {phoneValue && (
                      <button
                        type="button"
                        className={styles.removeButton}
                        onClick={() => {
                          setPendingRemovePhone(true);
                        }}
                      >
                        {t('account_center.security.remove')}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className={styles.title}>{t('account_center.security.phone')}</div>
              <div className={classNames(styles.value, !phoneValue && styles.secondaryValue)}>
                {phoneValue ?? t('account_center.security.not_set')}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        isOpen={pendingRemovePhone}
        title="account_center.security.remove_phone_confirmation_title"
        confirmText="account_center.security.remove"
        confirmButtonType="danger"
        cancelText="action.cancel"
        onConfirm={() => {
          void handleRemoveConfirm();
        }}
        onCancel={() => {
          setPendingRemovePhone(false);
        }}
      >
        {t('account_center.security.remove_phone_confirmation_description')}
      </ConfirmModal>
    </>
  );
};

export default EmailPhoneSection;
