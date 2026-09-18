import type { SendVerificationCodeInput, SmsSender } from './sms-sender';

function maskPhone(phone: string): string {
  if (phone.length <= 4) {
    return '****';
  }

  const prefix = phone.slice(0, 2);
  const suffix = phone.slice(-4);

  return `${prefix}******${suffix}`;
}

export class DevSmsSender implements SmsSender {
  async sendVerificationCode(input: SendVerificationCodeInput): Promise<void> {
    console.log(
      `[DEV SMS] Verification code for ${maskPhone(input.phone)}: ${input.code} (expires in ${input.expiresInMinutes} min)`,
    );
  }
}
