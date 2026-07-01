import { BrowserApiClient } from '@retail-os/api-client';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export const sellerApi = new BrowserApiClient(API_BASE, 'seller');
