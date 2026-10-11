import { useFormContext } from 'react-hook-form';

import { isCloud } from '@/consts/env';
import { latestProPlanId } from '@/consts/subscriptions';
import FormField from '@/ds-components/FormField';
import Switch from '@/ds-components/Switch';

import type { SignInExperienceForm } from '../../../types';

type Props = {
  readonly isEnabled: boolean;
};

function HideLogtoBrandingField({ isEnabled }: Props) {
  const { register } = useFormContext<SignInExperienceForm>();

  return (
    <FormField
      title="sign_in_exp.branding.hide_logto_branding"
      {...(isCloud
        ? {
            featureTag: {
              isVisible: !isEnabled,
              plan: latestProPlanId,
            },
          }
        : {})}
    >
      <Switch
        description="sign_in_exp.branding.hide_logto_branding_description"
        {...register('hideLogtoBranding')}
        disabled={!isEnabled}
      />
    </FormField>
  );
}

export default HideLogtoBrandingField;
