import { useContext } from 'react';

import { isCloud } from '@/consts/env';
import { SubscriptionDataContext } from '@/contexts/SubscriptionDataProvider';

/**
 * Whether hiding the Logto branding and configuring the Custom UI CSP are available.
 *
 * On Cloud, both fields are always part of the form, and the tenant subscription decides whether
 * they are enabled through the shared `bringYourUiEnabled` quota. Nightcord also makes both
 * features available on self-hosted deployments.
 */
const useBrandingEntitlements = () => {
  const { currentSubscriptionQuota } = useContext(SubscriptionDataContext);

  if (isCloud) {
    const { bringYourUiEnabled } = currentSubscriptionQuota;

    return {
      /** Whether the hide branding field is part of the form and its payload. */
      isHideLogtoBrandingAvailable: true,
      /** Whether the hide branding switch can be turned on. */
      isHideLogtoBrandingEnabled: bringYourUiEnabled,
      /** Whether the Custom UI CSP form can be edited and is part of the payload. */
      isCustomUiCspEnabled: bringYourUiEnabled,
    };
  }

  // Nightcord keeps branding and custom UI controls available in OSS.
  return {
    isHideLogtoBrandingAvailable: true,
    isHideLogtoBrandingEnabled: true,
    isCustomUiCspEnabled: true,
  };
};

export default useBrandingEntitlements;
