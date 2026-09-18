import type { EmailSender, SendVerificationCodeInput } from './email-sender';

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!domain || !localPart) {
    return '***';
  }

  const visible = localPart.slice(0, 1);

  return `${visible}***@${domain}`;
}

export class DevEmailSender implements EmailSender {
  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    console.log(
      `[DEV EMAIL] Verification code for ${maskEmail(input.email)}: ${input.code} (expires in ${input.expiresInMinutes} min)`,
    );
  }
}
