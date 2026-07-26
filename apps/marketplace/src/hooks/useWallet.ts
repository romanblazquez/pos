import { useQuery } from '@tanstack/react-query';
import { API_BASE, marketplaceApi } from '../lib/api-client.js';

export interface StoreCredit {
  balanceMinor: number;
  /** Currency this credit is denominated in — a seller trades in one market. */
  currency?: string | null;
  seller: { id: string; name: string };
}

/** Platform credit for one market, denominated in that market's currency. */
export interface MarketCredit {
  marketCode: string;
  currency: string;
  balanceMinor: number;
}

export interface Wallet {
  /** Undenominated legacy total. Never render this next to a currency symbol. */
  platformCreditsMinor: number;
  marketCredits?: MarketCredit[];
  storeCredits: StoreCredit[];
}

/**
 * What the shopper can actually spend in the market they are shopping in.
 *
 * Summing every credit into one number and labelling it MXN — which the header
 * used to do — adds pesos to australes and then lies about the result. Credits
 * are market-scoped by design (see the API's credit-eligibility rules), so a
 * balance only means anything alongside the market it belongs to.
 */
export function spendableInMarket(
  wallet: Wallet | undefined,
  marketCode: string,
  currency: string,
): number {
  if (!wallet) return 0;
  const market = wallet.marketCredits?.find(
    (credit) => credit.marketCode.toUpperCase() === marketCode.toUpperCase(),
  );
  const platform = market?.balanceMinor ?? 0;
  const store = wallet.storeCredits
    .filter((credit) => (credit.currency ?? '').toUpperCase() === currency.toUpperCase())
    .reduce((sum, credit) => sum + credit.balanceMinor, 0);
  return platform + store;
}

async function fetchWallet(customerId: string): Promise<Wallet> {
  const res = await marketplaceApi.fetch(`${API_BASE}/api/v1/customers/${customerId}/wallet`);
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
