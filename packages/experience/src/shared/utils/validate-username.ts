import { usernameRegEx } from '@logto/core-kit';

import type { ErrorType } from '@/shared/components/ErrorMessage';

export const validateUsername = (username: string): ErrorType | undefined => {
  if (!username) {
    return 'username_required';
  }

  if (!usernameRegEx.test(username)) {
    return 'username_invalid_charset';
  }
};
