import { useState } from 'react';
import { useIntl } from 'react-intl';
import { inputCls } from './ui/index.js';
import type { AddressInput } from '../hooks/useAddresses.js';

const EMPTY: AddressInput = { label: '', street: '', city: '', state: '', postalCode: '', country: 'MX' };

/** Shared shipping-address fields — used by the checkout "new address" form and the account Direcciones page. */
export function AddressForm({
  initial, onSubmit, onCancel, submitLabel, busy,
}: {
  initial?: Partial<AddressInput>;
  onSubmit: (input: AddressInput) => void;
  onCancel?: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const [form, setForm] = useState<AddressInput>({ ...EMPTY, ...initial });
  const intl = useIntl();

  function set<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const valid = form.street.trim() && form.city.trim() && form.state.trim() && form.postalCode.trim();

  return (
    <div className="space-y-3">
      <input
        value={form.label ?? ''}
        onChange={(e) => set('label', e.target.value)}
        placeholder={intl.formatMessage({ id: 'addressForm.labelPlaceholder' })}
        className={inputCls}
      />
      <input
        value={form.street}
        onChange={(e) => set('street', e.target.value)}
        placeholder={intl.formatMessage({ id: 'addressForm.streetPlaceholder' })}
        required
        className={inputCls}
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.city}
          onChange={(e) => set('city', e.target.value)}
          placeholder={intl.formatMessage({ id: 'addressForm.cityPlaceholder' })}
          required
          className={inputCls}
        />
        <input
          value={form.state}
          onChange={(e) => set('state', e.target.value)}
          placeholder={intl.formatMessage({ id: 'addressForm.statePlaceholder' })}
          required
          className={inputCls}
        />
      </div>
      <input
        value={form.postalCode}
        onChange={(e) => set('postalCode', e.target.value)}
        placeholder={intl.formatMessage({ id: 'addressForm.postalCodePlaceholder' })}
        required
        className={inputCls}
      />
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!valid || busy}
          className="flex-1 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {busy ? intl.formatMessage({ id: 'addressForm.saving' }) : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-[--tx-muted] hover:text-[--tx] transition-colors"
          >
            {intl.formatMessage({ id: 'addressForm.cancel' })}
          </button>
        )}
      </div>
    </div>
  );
}
