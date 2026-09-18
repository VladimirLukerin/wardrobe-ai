export function shouldUseDailySuggestFallback(params: {
  isServerAccount: boolean;
  dailyStylistEnabled: boolean;
  dailyProviderAttempted: boolean;
}): boolean {
  if (params.dailyProviderAttempted) {
    return false;
  }

  if (params.isServerAccount && params.dailyStylistEnabled) {
    return false;
  }

  return true;
}

export function getDailySuggestFallbackSkipReason(params: {
  isServerAccount: boolean;
  dailyStylistEnabled: boolean;
  dailyProviderAttempted: boolean;
}): 'provider_failure' | 'daily_stylist_enabled' | null {
  if (params.dailyProviderAttempted) {
    return 'provider_failure';
  }

  if (params.isServerAccount && params.dailyStylistEnabled) {
    return 'daily_stylist_enabled';
  }

  return null;
}
