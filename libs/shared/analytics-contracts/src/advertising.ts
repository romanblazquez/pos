import { resolveAdMode, type AdMode, type ConsentState } from './consent.js';

export interface AdRequest {
  placement: string;
  locale: string;
  pageType: string;
  entityType?: string;
  entityId?: string;
  mode: AdMode;
}

export interface AdCreative {
  provider: string;
  creativeId: string;
  campaignId?: string;
  imageUrl?: string;
  clickUrl?: string;
  width: number;
  height: number;
}

export interface AdvertisingAdapter {
  readonly provider: string;
  request(request: AdRequest): Promise<AdCreative | null>;
  destroy?(placement: string): void;
}

export function createAdRequest(
  state: ConsentState,
  request: Omit<AdRequest, 'mode'>,
): AdRequest {
  return { ...request, mode: resolveAdMode(state) };
}

/**
 * Local/E2E double. It exercises limited, non-personalized and personalized
 * modes without contacting an ad network or setting third-party identifiers.
 */
export class TestAdvertisingAdapter implements AdvertisingAdapter {
  readonly provider = 'test';
  readonly requests: AdRequest[] = [];

  async request(request: AdRequest): Promise<AdCreative> {
    this.requests.push(request);
    return {
      provider: this.provider,
      creativeId: `test-${request.mode}`,
      campaignId: 'local-test',
      imageUrl: `/ads/test-${request.mode}.svg`,
      clickUrl: '/guides',
      width: 970,
      height: 250,
    };
  }
}
