import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useCustomer } from '../context/CustomerContext.js';
import { useAddresses, type Address, type AddressInput } from '../hooks/useAddresses.js';
import { AddressForm } from '../components/AddressForm.js';
import { Card, CardContent, Badge, Button } from '../components/ui/index.js';

export default function AddressesPage() {
  const { session } = useCustomer();
  const { addresses, isLoading, create, update, remove } = useAddresses(session?.customer.id);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const intl = useIntl();

  if (!session) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[--tx]">{intl.formatMessage({ id: 'addresses.title' })}</h1>
        {!showNew && (
          <Button size="sm" onClick={() => setShowNew(true)}>{intl.formatMessage({ id: 'addresses.add' })}</Button>
        )}
      </div>

      {showNew && (
        <Card>
          <CardContent className="pt-5">
            <AddressForm
              submitLabel={intl.formatMessage({ id: 'addresses.saveNew' })}
              busy={create.isPending}
              onCancel={() => setShowNew(false)}
              onSubmit={(input) => create.mutate(input, { onSuccess: () => setShowNew(false) })}
            />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-[--bg-subtle] animate-pulse" />)}
        </div>
      ) : addresses.length === 0 && !showNew ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="text-3xl">📍</span>
            <p className="text-sm text-[--tx-muted]">{intl.formatMessage({ id: 'addresses.empty' })}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              editing={editingId === addr.id}
              onEdit={() => setEditingId(addr.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(input) => update.mutate({ id: addr.id, input }, { onSuccess: () => setEditingId(null) })}
              onDelete={() => remove.mutate(addr.id)}
              onSetDefault={() => update.mutate({ id: addr.id, input: { isDefault: true } })}
              busy={update.isPending || remove.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddressCard({
  address, editing, onEdit, onCancelEdit, onSave, onDelete, onSetDefault, busy,
}: {
  address: Address;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (input: AddressInput) => void;
  onDelete: () => void;
  onSetDefault: () => void;
  busy: boolean;
}) {
  const intl = useIntl();

  if (editing) {
    return (
      <Card>
        <CardContent className="pt-5">
          <AddressForm
            initial={{ ...address, label: address.label ?? undefined }}
            submitLabel={intl.formatMessage({ id: 'addresses.saveChanges' })}
            onCancel={onCancelEdit}
            onSubmit={onSave}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[--tx]">{address.label || intl.formatMessage({ id: 'addresses.fallbackLabel' })}</p>
            {address.isDefault && <Badge variant="success">{intl.formatMessage({ id: 'addresses.default' })}</Badge>}
          </div>
          <p className="text-sm text-[--tx-muted]">{address.street}</p>
          <p className="text-sm text-[--tx-muted]">{address.city}, {address.state} {address.postalCode}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0 text-xs">
          <button onClick={onEdit} className="text-emerald-600 hover:text-emerald-800 font-medium">{intl.formatMessage({ id: 'addresses.edit' })}</button>
          {!address.isDefault && (
            <button onClick={onSetDefault} disabled={busy} className="text-[--tx-muted] hover:text-[--tx]">
              {intl.formatMessage({ id: 'addresses.setDefault' })}
            </button>
          )}
          <button onClick={onDelete} disabled={busy} className="text-red-500 hover:text-red-700">{intl.formatMessage({ id: 'addresses.delete' })}</button>
        </div>
      </CardContent>
    </Card>
  );
}
