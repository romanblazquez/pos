import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface StoreCredit {
  balanceMinor: number;
  seller: { id: string; name: string };
}

export interface Wallet {
  platformCreditsMinor: number;
  storeCredits: StoreCredit[];
}

async function fetchWallet(customerId: string): Promise<Wallet> {
  const res = await fetch(`${API}/api/v1/customers/${customerId}/wallet`);
  if (!res.ok) throw new Error(`wallet fetch failed: ${res.status}`);
  return res.json() as Promise<Wallet>;
}

/** Shared wallet fetch — used by the account summary, wallet page, header balance, and checkout credit toggle. */
export function useWallet(customerId: string | undefined) {
  return useQuery({
    queryKey: ['wallet', customerId],
    queryFn: () => fetchWallet(customerId!),
    enabled: !!customerId,
    retry: false,
  });
}

/** Store credit balance for a specific seller — store credits are seller-scoped, not platform-wide. */
export function storeCreditFor(wallet: Wallet | undefined, sellerId: string): number {
  return wallet?.storeCredits.find((sc) => sc.seller.id === sellerId)?.balanceMinor ?? 0;
}
