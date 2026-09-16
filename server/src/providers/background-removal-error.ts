export type BackgroundRemovalProviderName = 'local' | 'removebg';

export class BackgroundRemovalError extends Error {
  readonly statusCode: number;
  readonly provider: BackgroundRemovalProviderName;

  constructor(message: string, statusCode: number, provider: BackgroundRemovalProviderName) {
    super(message);
    this.name = 'BackgroundRemovalError';
    this.statusCode = statusCode;
    this.provider = provider;
  }
}
