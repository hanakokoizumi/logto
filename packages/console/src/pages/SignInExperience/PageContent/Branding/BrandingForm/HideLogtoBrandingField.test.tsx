import { fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';

import HideLogtoBrandingField from './HideLogtoBrandingField';

jest.mock('@/consts/env', () => ({ isCloud: false }));
jest.mock('@/components/Region', () => ({ defaultRegionName: 'US' }));
jest.mock('@/scss/modal.module.scss', () => ({}));
jest.mock('@/components/FeatureTag', () => ({
  default: () => null,
  CombinedAddOnAndFeatureTag: () => null,
}));

const renderField = (isEnabled = true) => {
  function Wrapper() {
    const form = useForm({ defaultValues: { hideLogtoBranding: false } });
    const { watch } = form;

    return (
      <FormProvider {...form}>
        <HideLogtoBrandingField isEnabled={isEnabled} />
        <output>{String(watch('hideLogtoBranding'))}</output>
      </FormProvider>
    );
  }

  return render(<Wrapper />);
};

describe('hide Logto branding in OSS', () => {
  it('lets an operator change the saved branding preference', () => {
    renderField();
    const input = screen.getByRole<HTMLInputElement>('checkbox');

    expect(input.disabled).toBe(false);
    fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(screen.getByText('true')).toBeTruthy();
    fireEvent.click(input);
    expect(input.checked).toBe(false);
    expect(screen.getByText('false')).toBeTruthy();
  });

  it('does not render Cloud or self-hosted plan promotion links', () => {
    renderField();

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('respects a disabled control', () => {
    renderField(false);

    expect(screen.getByRole<HTMLInputElement>('checkbox').disabled).toBe(true);
  });
});
