export type SendVerificationCodeInput = {
  email: string;
  code: string;
  expiresInMinutes: number;
};

export interface EmailSender {
  sendVerificationCode(input: SendVerificationCodeInput): Promise<void>;
}
