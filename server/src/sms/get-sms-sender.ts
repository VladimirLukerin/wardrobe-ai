import { DevSmsSender } from './dev-sms-sender';
import type { SmsSender } from './sms-sender';

let smsSender: SmsSender | null = null;

export function getSmsSender(): SmsSender {
  if (smsSender) {
    return smsSender;
  }

  const provider = process.env.AUTH_SMS_PROVIDER?.trim() || 'dev';
  const isProduction = process.env.NODE_ENV === 'production';

  if (provider === 'dev') {
    if (isProduction) {
      throw new Error('Dev SMS provider is disabled in production.');
    }

    smsSender = new DevSmsSender();
    return smsSender;
  }

  throw new Error(`Unsupported AUTH_SMS_PROVIDER: ${provider}`);
}
