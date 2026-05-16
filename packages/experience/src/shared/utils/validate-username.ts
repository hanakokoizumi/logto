import { usernameRegEx } from '@logto/core-kit';

import type { ErrorType } from '@/shared/components/ErrorMessage';

export const validateUsername = (username: string): ErrorType | undefined => {
  if (!username) {
    return 'username_required';
  }

  if (username.toLowerCase().startsWith('tg_')) {
    return 'username_should_not_start_with_tg_prefix';
  }

  if (!usernameRegEx.test(username)) {
    return 'username_invalid_charset';
  }
};
