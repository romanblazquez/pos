import { BrowserApiClient } from '@retail-os/api-client';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const marketplaceApi = new BrowserApiClient(API_BASE, 'marketplace');
