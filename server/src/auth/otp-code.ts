import crypto from 'crypto';

export const OTP_TTL_SECONDS = 600;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_MAX_REQUESTS_WINDOW_SECONDS = 15 * 60;
export const OTP_MAX_REQUESTS_PER_WINDOW = 5;

export function isEmailVerificationConfigured(): boolean {
  return Boolean(process.env.AUTH_OTP_SECRET?.trim());
}

export function isPhoneVerificationConfigured(): boolean {
  return isEmailVerificationConfigured();
}

function getOtpSecret(): string {
  const secret = process.env.AUTH_OTP_SECRET?.trim();

  if (!secret) {
    throw new Error('Email verification is not configured.');
  }

  return secret;
}

export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtpCode({
  challengeId,
  email,
  purpose,
  code,
}: {
  challengeId: string;
  email: string;
  purpose: string;
  code: string;
}): string {
  const secret = getOtpSecret();

  return crypto
    .createHmac('sha256', secret)
    .update(`${challengeId}:${email}:${purpose}:${code}`)
    .digest('hex');
}

export function verifyOtpCode(input: {
  challengeId: string;
  email: string;
  purpose: string;
  code: string;
  codeHash: string;
}): boolean {
  const expectedHash = hashOtpCode({
    challengeId: input.challengeId,
    email: input.email,
    purpose: input.purpose,
    code: input.code,
  });

  const left = Buffer.from(expectedHash, 'hex');
  const right = Buffer.from(input.codeHash, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function hashPhoneOtpCode({
  challengeId,
  phone,
  purpose,
  code,
}: {
  challengeId: string;
  phone: string;
  purpose: string;
  code: string;
}): string {
  const secret = getOtpSecret();

  return crypto
    .createHmac('sha256', secret)
    .update(`${challengeId}:${phone}:phone:${purpose}:${code}`)
    .digest('hex');
}

export function verifyPhoneOtpCode(input: {
  challengeId: string;
  phone: string;
  purpose: string;
  code: string;
  codeHash: string;
}): boolean {
  const expectedHash = hashPhoneOtpCode({
    challengeId: input.challengeId,
    phone: input.phone,
    purpose: input.purpose,
    code: input.code,
  });

  const left = Buffer.from(expectedHash, 'hex');
  const right = Buffer.from(input.codeHash, 'hex');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}
