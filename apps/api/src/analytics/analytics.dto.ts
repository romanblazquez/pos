import type { AnalyticsBatch, ConsentState } from '@retail-os/analytics-contracts';

export interface CollectAnalyticsDto extends AnalyticsBatch {}

export interface RecordConsentDto {
  visitorId?: string;
  consent: ConsentState;
}

export interface LinkVisitorDto {
  visitorId: string;
  method?: 'login' | 'registration';
}

export interface PrivacyRequestDto {
  type: 'export' | 'delete';
  visitorId?: string;
}

export interface AnalyticsRangeDto {
  from?: string;
  to?: string;
  limit?: string;
  cursor?: string;
  eventType?: string;
  query?: string;
}

