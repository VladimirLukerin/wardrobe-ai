import type { EmailSender } from './email-sender';
import { DevEmailSender } from './dev-email-sender';

let emailSender: EmailSender | null = null;
let emailSenderOverride: EmailSender | null = null;

export function setEmailSenderForTests(sender: EmailSender | null): void {
  emailSenderOverride = sender;
}

export function getEmailSender(): EmailSender {
  if (emailSenderOverride) {
    return emailSenderOverride;
  }

  if (emailSender) {
    return emailSender;
  }

  const provider = process.env.AUTH_EMAIL_PROVIDER?.trim() || 'dev';
  const isProduction = process.env.NODE_ENV === 'production';

  if (provider === 'dev') {
    if (isProduction) {
      throw new Error('Dev email provider is disabled in production.');
    }

    emailSender = new DevEmailSender();
    return emailSender;
  }

  throw new Error(`Unsupported AUTH_EMAIL_PROVIDER: ${provider}`);
}
