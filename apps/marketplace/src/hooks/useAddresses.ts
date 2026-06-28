import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE, marketplaceApi } from '../lib/api-client.js';


export interface Address {
  id: string;
  label: string | null;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface AddressInput {
  label?: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
}

/** Shared CRUD for a customer's saved delivery addresses — used by both the
 * checkout shipping step and the account "Direcciones" management page. */
export function useAddresses(customerId: string | undefined) {
  const qc = useQueryClient();
  const queryKey = ['addresses', customerId];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<Address[]> => {
      const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/addresses`);
      if (!res.ok) throw new Error('fetch failed');
      return res.json() as Promise<Address[]>;
    },
    enabled: !!customerId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: async (input: AddressInput): Promise<Address> => {
      const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('create failed');
      return res.json() as Promise<Address>;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<AddressInput> }): Promise<Address> => {
      const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/addresses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('update failed');
      return res.json() as Promise<Address>;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/addresses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
    },
    onSuccess: invalidate,
  });

  return {
    addresses: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
  };
}
