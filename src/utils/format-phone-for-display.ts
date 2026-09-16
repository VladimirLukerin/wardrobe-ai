import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);

  if (!parsed) {
    return e164;
  }

  return parsed.formatInternational();
}

export function formatPhoneMaskedForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);

  if (!parsed) {
    if (e164.length <= 4) {
      return e164;
    }

    return `${e164.slice(0, 3)} ••• •••-••-${e164.slice(-2)}`;
  }

  const lastTwo = parsed.nationalNumber.slice(-2);

  return `+${parsed.countryCallingCode} ••• •••-••-${lastTwo}`;
}
