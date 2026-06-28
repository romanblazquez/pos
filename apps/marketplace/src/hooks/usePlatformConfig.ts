import { useQuery } from '@tanstack/react-query';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface PlatformConfig {
  platformCashbackPct: number;
  baseCommissionPct: number;
  minCommissionPct: number;
}

async function fetchPlatformConfig(): Promise<PlatformConfig> {
  const res = await fetch(`${API}/api/v1/marketplace/loyalty/config`);
  if (!res.ok) return { platformCashbackPct: 0.01, baseCommissionPct: 0.05, minCommissionPct: 0.02 };
  return res.json() as Promise<PlatformConfig>;
}

export function usePlatformConfig() {
  return useQuery({
    queryKey: ['platform-config'],
    queryFn: fetchPlatformConfig,
    staleTime: 5 * 60 * 1000, // 5 min — config changes rarely
  });
}
