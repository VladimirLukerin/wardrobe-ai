export const AI_USAGE_REQUEST_TYPES = ['photo', 'suggest', 'daily', 'paired'] as const;

export type AiUsageRequestType = (typeof AI_USAGE_REQUEST_TYPES)[number];

export const AI_USAGE_STATUSES = [
  'success',
  'provider_rate_limited',
  'provider_error',
  'invalid_response',
] as const;

export type AiUsageStatus = (typeof AI_USAGE_STATUSES)[number];

export type RecordAiUsageEventInput = {
  userId: string | null;
  requestType: AiUsageRequestType;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  status: AiUsageStatus;
  providerErrorCode?: string | null;
  providerRequestId?: string | null;
};
