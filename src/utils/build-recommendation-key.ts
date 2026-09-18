export function buildDailyRecommendationKey(localDate: string, inputSignature: string): string {
  return `daily:${localDate}:${inputSignature}`;
}

export function buildHomeSuggestRecommendationKey(inputSignature: string): string {
  return `home:${inputSignature}`;
}
