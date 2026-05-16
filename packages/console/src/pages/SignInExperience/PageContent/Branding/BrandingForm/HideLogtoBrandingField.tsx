import { useFormContext } from 'react-hook-form';

import { latestProPlanId } from '@/consts/subscriptions';
import FormField from '@/ds-components/FormField';
import Switch from '@/ds-components/Switch';

import type { SignInExperienceForm } from '../../../types';

type Props = {
  readonly isCloud: boolean;
  /** When false on Logto Cloud, the switch is disabled behind the Pro feature tag. OSS always allows toggling. */
  readonly isEnabledInCloud: boolean;
};

function HideLogtoBrandingField({ isCloud, isEnabledInCloud }: Props) {
  const { register } = useFormContext<SignInExperienceForm>();
  const canToggle = !isCloud || isEnabledInCloud;

  return (
    <FormField
      title="sign_in_exp.branding.hide_logto_branding"
      {...(isCloud
        ? {
            featureTag: {
              isVisible: !isEnabledInCloud,
              plan: latestProPlanId,
            },
          }
        : {})}
    >
      <Switch
        description="sign_in_exp.branding.hide_logto_branding_description"
        {...register('hideLogtoBranding')}
        disabled={!canToggle}
      />
    </FormField>
  );
}

export default HideLogtoBrandingField;
