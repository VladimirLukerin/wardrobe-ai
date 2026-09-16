export type SendVerificationCodeInput = {
  phone: string;
  code: string;
  expiresInMinutes: number;
};

export interface SmsSender {
  sendVerificationCode(input: SendVerificationCodeInput): Promise<void>;
}
