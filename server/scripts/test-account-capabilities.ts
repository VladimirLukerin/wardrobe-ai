import { canUseFamilyFeatures, requiresProtectedAccount } from '../../src/utils/account-capabilities';
import type { ServerUser } from '../../src/services/account';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function buildUser(overrides: Partial<ServerUser>): ServerUser {
  return {
    id: 'user-1',
    publicId: 'public-1',
    displayName: 'Test User',
    email: null,
    emailVerified: false,
    phone: null,
    phoneVerified: false,
    hasPassword: false,
    createdAt: '2026-09-18T10:00:00.000Z',
    ...overrides,
  };
}

function testGuestCannotUseFamily(): void {
  const guest = buildUser({});

  assert(canUseFamilyFeatures(guest) === false, 'Guest should not use family features');
  assert(requiresProtectedAccount(guest) === false, 'Guest should not pass protected gate');

  console.log('OK guest cannot use family');
}

function testEmailVerifiedCanUseFamily(): void {
  const user = buildUser({ email: 'user@example.com', emailVerified: true });

  assert(canUseFamilyFeatures(user) === true, 'Email verified user should use family');
  assert(requiresProtectedAccount(user) === true, 'Email verified user should pass protected gate');

  console.log('OK email verified can use family');
}

function testPhoneVerifiedCanUseFamily(): void {
  const user = buildUser({ phone: '+79990000000', phoneVerified: true });

  assert(canUseFamilyFeatures(user) === true, 'Phone verified user should use family');
  assert(requiresProtectedAccount(user) === true, 'Phone verified user should pass protected gate');

  console.log('OK phone verified can use family');
}

function testBothVerifiedCanUseFamily(): void {
  const user = buildUser({
    email: 'user@example.com',
    emailVerified: true,
    phone: '+79990000000',
    phoneVerified: true,
  });

  assert(canUseFamilyFeatures(user) === true, 'Fully verified user should use family');

  console.log('OK both verified can use family');
}

function testNullUserCannotUseFamily(): void {
  assert(canUseFamilyFeatures(null) === false, 'Null user should not use family');
  assert(requiresProtectedAccount(undefined) === false, 'Undefined user should not pass protected gate');

  console.log('OK null user cannot use family');
}

function main(): void {
  testGuestCannotUseFamily();
  testEmailVerifiedCanUseFamily();
  testPhoneVerifiedCanUseFamily();
  testBothVerifiedCanUseFamily();
  testNullUserCannotUseFamily();
  console.log('All account capabilities checks passed.');
}

main();
