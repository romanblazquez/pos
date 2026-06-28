import { BrowserApiClient } from '@retail-os/api-client';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';
export const adminApi = new BrowserApiClient(API_BASE, 'admin');
