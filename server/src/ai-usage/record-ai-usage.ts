import { APIError } from 'openai';

import {
  isOpenAiProviderRateLimitError,
} from '../outfit-ai/provider-rate-limit';
import { insertAiUsageEvent } from './ai-usage-repository';
import type { AiUsageRequestType, RecordAiUsageEventInput } from './ai-usage-types';

export function recordAiUsageEvent(input: RecordAiUsageEventInput): void {
  try {
    insertAiUsageEvent(input);
  } catch (error) {
    console.warn('Failed to record AI usage event:', error);
  }
}

type OpenAiUsageResponse = {
  id?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

function readTokenCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function readProviderRequestId(response: OpenAiUsageResponse): string | null {
  return typeof response.id === 'string' && response.id.trim().length > 0 ? response.id : null;
}

function mapProviderErrorCode(error: unknown): string | null {
  if (error instanceof APIError && typeof error.code === 'string') {
    return error.code;
  }

  return null;
}

export async function trackOpenAiResponsesCall<T extends OpenAiUsageResponse>(
  params: {
    userId: string | null;
    requestType: AiUsageRequestType;
    call: () => Promise<T>;
  },
): Promise<T> {
  const startedAt = Date.now();

  try {
    const response = await params.call();
    const inputTokens = readTokenCount(response.usage?.input_tokens);
    const outputTokens = readTokenCount(response.usage?.output_tokens);
    const totalTokens = readTokenCount(response.usage?.total_tokens);

    recordAiUsageEvent({
      userId: params.userId,
      requestType: params.requestType,
      inputTokens,
      outputTokens,
      totalTokens: totalTokens || inputTokens + outputTokens,
      durationMs: Date.now() - startedAt,
      status: 'success',
      providerRequestId: readProviderRequestId(response),
    });

    return response;
  } catch (error) {
    const status = isOpenAiProviderRateLimitError(error) ? 'provider_rate_limited' : 'provider_error';

    recordAiUsageEvent({
      userId: params.userId,
      requestType: params.requestType,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      durationMs: Date.now() - startedAt,
      status,
      providerErrorCode: mapProviderErrorCode(error),
    });

    throw error;
  }
}
